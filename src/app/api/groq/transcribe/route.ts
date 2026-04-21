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

    const formData = await req.formData();
    const file = formData.get('file') as Blob;
    const model = formData.get('model') as string || 'whisper-large-v3-turbo';

    const keys = await getProviderKeys('GROQ');
    const apiKey = keys[0] || null;
    if (!apiKey) {
      return NextResponse.json({ error: "Groq API Key not configured. Add it to the Vault in Admin Suite." }, { status: 401 });
    }
    if (!file) {
      return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
    }

    const groqFormData = new FormData();
    groqFormData.append('file', file, 'recording.webm');
    groqFormData.append('model', model);

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: groqFormData,
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Whisper Error: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Transcription Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
