import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const isServer = typeof window === 'undefined';
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const getSupabaseUrl = () => {
  if (!rawUrl) return '';
  if (isServer) {
    return rawUrl.includes('flowr.website')
      ? 'https://qmufalwubepttjxehvit.supabase.co'
      : rawUrl;
  }
  // Client-side: dynamically match active browser origin to bypass CORS preflight redirect blocks
  if (rawUrl.includes('flowr.website')) {
    try {
      const parsed = new URL(rawUrl);
      return `${window.location.origin}${parsed.pathname}`;
    } catch {
      return `${window.location.origin}`;
    }
  }
  return rawUrl;
};

const url = getSupabaseUrl();

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

export const supabase = url && key 
  ? createBrowserClient(url, key, {
      realtime: {
        transport: ProxyWebSocket,
      },
      cookieOptions: {
        name: 'sb-flowr-auth',
      },
    })
  : (null as any);

export const isSupabaseEnabled = !!(url && key);

export const supabaseAdmin = url && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : (null as any);
