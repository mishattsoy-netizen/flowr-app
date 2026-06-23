User request: "" (in reference to Google OAuth redirect_uri_mismatch 400 error screenshot)

0. Date and time of the request:
2026-06-17 23:42

1. User request:
"" (Google OAuth redirect_uri_mismatch screenshot)

2. Objective Reconstruction:
Diagnose and resolve the Google OAuth "Error 400: redirect_uri_mismatch" issue occurring during login. Explain why the default Supabase callback URL must remain registered in Google Cloud Console Credentials alongside the custom domain callback, particularly during local development.

3. Strategic Reasoning:
- **Host Header Behavior**: Because local Next.js proxy rewrites strip/rewrite the Host header to `qmufalwubepttjxehvit.supabase.co` to route to Supabase, the Supabase authentication server constructs the initial Google OAuth request using its direct domain `https://qmufalwubepttjxehvit.supabase.co/auth/v1/callback`.
- **Credential whitelist constraint**: If this original callback is missing from the Google Credentials authorized list, Google rejects the request with a redirect_uri_mismatch.
- **Isomorphic Dev-Prod callback support**: Keeping both the direct Supabase callback and the custom domain callback in Google Cloud Console guarantees that both local dev and production systems authenticate successfully.

4. Detailed Blueprint:
- Analyze mismatch logic.
- Guide the user to re-add/keep the original Supabase callback (`https://qmufalwubepttjxehvit.supabase.co/auth/v1/callback`) in Google Cloud Console.

5. Operational Trace:
- Outlined necessary authorized redirect URIs for Google Web Client settings.

6. Status Assessment:
- Diagnostics and solutions provided.
