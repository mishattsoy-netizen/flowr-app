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

    const { model, contents, system_instruction, generationConfig, tools: geminiTools } = await req.json();

    let apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      const keys = await getProviderKeys('GEMINI');
      apiKey = keys[0] || null;
    }
    
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API Key not configured. Add it to the Vault in Admin Suite." }, { status: 401 });
    }

    const cleanModel = (model || 'gemini-2.5-flash')
      .replace('google/', '')
      .replace(':free', '');

    const isImagen = cleanModel.includes('imagen');
    const apiVersion = 'v1beta';

    if (isImagen) {
      const lastMsg = contents?.[contents.length - 1];
      let prompt = "Conceptual art";
      if (lastMsg?.parts) {
        for (const part of lastMsg.parts) {
          if (part.text?.trim()) { prompt = part.text.trim(); break; }
        }
      }

      async function tryImagenRequest(ver: string, method: string = 'predict') {
        const url = `https://generativelanguage.googleapis.com/${ver}/models/${cleanModel}:${method}?key=${apiKey}`;
        const body = method === 'generateContent'
          ? { contents: [{ parts: [{ text: prompt }] }] }
          : { instances: [{ prompt }] };
        return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }

      let response = await tryImagenRequest('v1beta', 'generateContent');
      if (!response.ok) response = await tryImagenRequest('v1beta', 'predict');

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = errText;
        try { const p = JSON.parse(errText); errMsg = p.error?.message || p.message || errText; } catch {}
        return NextResponse.json({ error: `Imagen API Error (${response.status}): ${errMsg}` }, { status: response.status });
      }

      const data = await response.json();
      const prediction = data.predictions?.[0];
      const base64 = prediction?.bytesBase64Encoded;
      const mimeType = prediction?.mimeType || 'image/png';

      if (!base64) {
        return NextResponse.json({ error: "Imagen response missing image data." }, { status: 500 });
      }

      const stream = new ReadableStream({
        start(controller) {
          const imageMarkdown = `\n![Generated Image](data:${mimeType};base64,${base64})\n`;
          const sseData = JSON.stringify({ candidates: [{ content: { parts: [{ text: imageMarkdown }] } }] });
          controller.enqueue(new TextEncoder().encode(`data: ${sseData}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });
      return new NextResponse(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    }

    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${cleanModel}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents,
        system_instruction,
        generationConfig,
        ...(geminiTools?.length > 0 ? {
          tool_config: { function_calling_config: { mode: "AUTO" } },
          tools: [{ function_declarations: geminiTools.map((t: any) => t.function || t) }]
        } : {})
      }),
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
    console.error("Gemini Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
