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
      const keys = await getProviderKeys('GROQ');
      apiKey = keys[0] || null;
    }
    
    if (!apiKey) {
      return NextResponse.json({ error: "Groq API Key not configured. Add it to the Vault in Admin Suite." }, { status: 401 });
    }

    const modelName = (body.model || '').replace(/^groq\//, '');
    const isWhisper = modelName.toLowerCase().includes('whisper');

    if (isWhisper) {
      let audioData = "";
      const lastMsg = body.messages?.[body.messages.length - 1];
      if (Array.isArray(lastMsg?.content)) {
        for (const part of lastMsg.content) {
          if (part.image_url?.url?.startsWith('data:audio/')) {
            audioData = part.image_url.url;
            break;
          }
        }
      }
      if (!audioData && lastMsg?.attachments) {
        const audio = lastMsg.attachments.find((a: any) => a.type === 'audio');
        if (audio) audioData = audio.url;
      }
      if (!audioData) {
        return NextResponse.json({ error: "No audio file found for Whisper transcription." }, { status: 400 });
      }

      const match = audioData.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return NextResponse.json({ error: "Invalid audio data format." }, { status: 400 });
      const mimeType = match[1];
      const binaryContent = Buffer.from(match[2], 'base64');
      const blob = new Blob([binaryContent], { type: mimeType });

      const formData = new FormData();
      formData.append('file', blob, `audio.${mimeType.split('/')[1] || 'mp3'}`);
      formData.append('model', modelName);

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json({ error: `Whisper Error: ${errText}` }, { status: response.status });
      }

      const data = await response.json();
      const stream = new ReadableStream({
        start(controller) {
          const sseData = JSON.stringify({ choices: [{ delta: { content: data.text } }] });
          controller.enqueue(new TextEncoder().encode(`data: ${sseData}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });
      return new NextResponse(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    }

    const cleanBody = { ...body, model: modelName };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify(cleanBody),
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
    console.error("Groq Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
