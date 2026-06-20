import { createBrowserClient } from '@supabase/ssr'

const ProxyWebSocket = (typeof window !== 'undefined' && window.WebSocket
  ? class extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const realUrl = url.toString().replace(
          /^(ws|wss):\/\/[^\/]+/,
          'wss://qmufalwubepttjxehvit.supabase.co'
        );
        super(realUrl, protocols);
      }
    }
  : undefined) as any;

export function createClient() {
  const isServer = typeof window === 'undefined';
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  let url = rawUrl;
  if (isServer) {
    url = rawUrl && rawUrl.includes('flowr.website')
      ? 'https://qmufalwubepttjxehvit.supabase.co'
      : rawUrl;
  } else if (rawUrl && rawUrl.includes('flowr.website')) {
    try {
      const parsed = new URL(rawUrl);
      url = `${window.location.origin}${parsed.pathname}`;
    } catch {
      url = `${window.location.origin}`;
    }
  }

  return createBrowserClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        transport: ProxyWebSocket,
      },
    }
  )
}
