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
    const keys = await getProviderKeys('OPENROUTER');

    if (keys.length === 0) {
      return NextResponse.json({ error: "OpenRouter API Key not configured. Add it to the Vault in Admin Suite." }, { status: 401 });
    }

    // Try keys with rotation on 401/402/403 (key exhausted or insufficient credits)
    let lastError: string | null = null;
    for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
      const apiKey = keys[keyIdx];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);

      try {
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
          
          // If key is exhausted (401/402/403) and we have more keys, try next one
          if ((response.status === 401 || response.status === 402 || response.status === 403) && keyIdx < keys.length - 1) {
            lastError = `Key ${keyIdx + 1} exhausted (${response.status}), trying next key...`;
            console.warn(`[OpenRouter Proxy] ${lastError}`);
            continue; // Try next key
          }
          
          return NextResponse.json({ error: errMsg }, { status: response.status });
        }

        // If we had to rotate past a bad key, log success
        if (keyIdx > 0) {
          console.log(`[OpenRouter Proxy] Key rotation succeeded: key ${keyIdx + 1}/${keys.length}`);
        }

        return new NextResponse(response.body, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        });
      } catch (fetchError: any) {
        clearTimeout(timeout);
        if (fetchError.name === 'AbortError') {
          return NextResponse.json({ error: "Request timed out. Please try again." }, { status: 504 });
        }
        lastError = fetchError.message;
        console.warn(`[OpenRouter Proxy] Key ${keyIdx + 1} error: ${fetchError.message}`);
        // If last key also failed, return the error
        if (keyIdx < keys.length - 1) continue;
      }
    }

    // All keys exhausted
    return NextResponse.json({ error: lastError || "All OpenRouter API keys exhausted." }, { status: 503 });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: "Request timed out. Please try again." }, { status: 504 });
    }
    console.error("OpenRouter Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
