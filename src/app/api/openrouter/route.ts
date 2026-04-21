import { NextRequest, NextResponse } from 'next/server';
import { getProviderKeys } from '@/lib/vault';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      const keys = await getProviderKeys('OPENROUTER');
      apiKey = keys[0] || null;
    }
    
    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API Key not configured. Add it to the Vault in Admin Suite." }, { status: 401 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://flowr.ai',
        'X-Title': 'Flowr 4.1',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = errText;
      try { errMsg = JSON.parse(errText)?.error?.message || errText; } catch {}
      return NextResponse.json({ error: errMsg }, { status: response.status });
    }

    return new NextResponse(response.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: "Request timed out. Please try again." }, { status: 504 });
    }
    console.error("OpenRouter Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
