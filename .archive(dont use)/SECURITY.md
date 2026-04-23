# Security Rules

## API Keys & Secrets

- **ALL** API keys, passwords, and secrets must live exclusively in server-side environment variables (`.env.local`, Vercel env, etc.) or Supabase server-side config.
- **Never** expose any secret in frontend code, client components, `NEXT_PUBLIC_*` vars, or bundled JS.
- All AI provider keys (Groq, Gemini, OpenRouter, etc.) must only be read inside `src/app/api/**` route handlers — never imported or referenced in `src/components/**` or any `"use client"` file.
- When adding a new integration, create a `src/app/api/<provider>/route.ts` server route and call it from the frontend via `fetch`. The key never leaves the server.

## Supabase

- Use the **anon/public** key only for unauthenticated read operations that are safe to expose (e.g. public schema reads with RLS enforced).
- Use the **service_role** key only in server-side API routes. Never in client code.
- All sensitive DB operations (writes, admin queries) must go through server routes authenticated with `service_role`.

## Auth (upcoming)

- User authentication will be handled via Supabase Auth. Prepare all protected routes to check session server-side using `createServerClient` from `@supabase/ssr`.
- Never trust client-provided user IDs for authorization — always derive the user from the verified server-side session.
- RLS policies must be the final enforcement layer — server-side checks are defense-in-depth, not the only gate.

## General

- No secrets in git. `.env.local` must be in `.gitignore`.
- Rotate any key that was ever committed or logged to the client.
- Treat `console.log` in API routes carefully — never log full keys or tokens, even in dev.
