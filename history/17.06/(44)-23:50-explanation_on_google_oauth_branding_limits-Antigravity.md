User request: "i dont understand why do i still see supabase url in login page?"

0. Date and time of the request:
2026-06-17 23:50

1. User request:
"i dont understand why do i still see supabase url in login page?"

2. Objective Reconstruction:
Provide a clear, detailed breakdown explaining why the Supabase domain appears in the Google OAuth consent overlay ("continue to qmufalwubepttjxehvit.supabase.co") under the free proxy setup, and reinforce that this is a direct limitation of the free tier.

3. Strategic Reasoning:
- **Free Rewrite Limitation**: Explain that since the Next.js rewrite proxy must send the header `Host: qmufalwubepttjxehvit.supabase.co` (otherwise Supabase's free tenant router rejects the request), Supabase's authentication service initiates the Google OAuth request using its native domain.
- **Google Display Rule**: Google extracts the "continue to [domain]" text exclusively from the origin of the `redirect_uri` parameter (which is `https://qmufalwubepttjxehvit.supabase.co/auth/v1/callback` under the free setup).
- **Resolution Path**: Clarify that mapping it directly to show "continue to flowr.website" requires purchasing the Supabase Pro Custom Domain add-on (~$10/month).

4. Detailed Blueprint:
- Outline request-response flow for local dev and production.
- Define trade-off boundaries clearly.

5. Operational Trace:
- Documented domain transition logic.

6. Status Assessment:
- Diagnostics and solutions provided.
