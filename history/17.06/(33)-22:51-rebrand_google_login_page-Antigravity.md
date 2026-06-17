User request: "can we chage this google login page to flowr.website url with logo not supabase, so it looks beautiful and premium"

0. Date and time of the request:
2026-06-17 22:51

1. User request:
"can we chage this google login page to flowr.website url with logo not supabase, so it looks beautiful and premium"

2. Objective Reconstruction:
Provide step-by-step instructions to configure a custom domain (e.g., `auth.flowr.website`) in Supabase and upload the custom Flowr logo and domain values in Google Cloud Console. Update codebase configurations (`sw.js` and local env guides) to support routing authentication redirects through the custom domain.

3. Strategic Reasoning:
- **DNS/Branding Autonomy**: Branding properties on Google Sign-In consent screens are controlled via the OAuth application settings in Google Cloud Console, and domain routing is managed via Supabase Custom Domain mapping.
- **Service Worker Cache Exemption**: When auth redirects migrate to a custom domain (like `auth.flowr.website`), requests to this domain must be exempt from service worker shell caching. We updated the `isApiOrSupabase` helper function to matches subdomains of `flowr.website`.

4. Detailed Blueprint:
- [public/sw.js](file:///Users/mktsoy/Dev/flowr-app/public/sw.js): Whitelist `flowr.website` subdomains from caching.
- [docs/auth-custom-domain-setup.md](file:///Users/mktsoy/Dev/flowr-app/docs/auth-custom-domain-setup.md): Complete dashboard configuration walkthrough.

5. Operational Trace:
- Modified caching logic in `public/sw.js` to whitelist `flowr.website` subdomains.
- Created `docs/auth-custom-domain-setup.md` reference checklist.
- Verified TypeScript compilation: `/Users/mktsoy/.local/bin/node node_modules/typescript/bin/tsc --noEmit` -> Success with 0 errors.

6. Status Assessment:
- The codebase changes are ready. Once you follow the settings guide to map the custom domain, the login screen will reflect the Flowr brand and domain successfully.
