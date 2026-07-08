import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const isServer = typeof window === 'undefined';
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const getSupabaseUrl = () => {
  if (!rawUrl) return '';
  if (isServer) {
    if (rawUrl.includes('localhost') && process.env.PORT) {
      return `http://127.0.0.1:${process.env.PORT}`;
    }
    return rawUrl.includes('flowr.website')
      ? 'https://qmufalwubepttjxehvit.supabase.co'
      : rawUrl;
  }
  // Client-side: dynamically match active browser origin to bypass CORS preflight redirect blocks
  // and support random Electron ports.
  if (rawUrl.includes('flowr.website') || rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')) {
    try {
      const parsed = new URL(rawUrl);
      return `${window.location.origin}${parsed.pathname}`;
    } catch {
      return `${window.location.origin}`;
    }
  }
  return rawUrl;
};
export const supabaseUrl = getSupabaseUrl();
export const supabaseAnonKey = key;

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

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        transport: ProxyWebSocket,
      },
      cookieOptions: {
        name: 'sb-flowr-auth',
      },
    })
  : (null as any);

export const isSupabaseEnabled = !!(supabaseUrl && supabaseAnonKey);

// Admin client must use the REAL Supabase URL, not the proxied localhost URL,
// so storage uploads go directly to Supabase instead of through Next.js rewrites
const SUPABASE_PROJECT_URL = 'https://qmufalwubepttjxehvit.supabase.co';
export const supabaseAdmin = supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : (null as any);
