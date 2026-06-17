# Custom Auth Domain Setup Guide (Next.js Rewrite Proxy)

To change the Google Sign-In consent domain from Supabase (`qmufalwubepttjxehvit.supabase.co`) to `flowr.website` for free, we use a built-in Next.js Rewrite proxy. This routes authentication traffic through your own domain.

---

## Step 1: Configure App Branding in Google Cloud Console

To register your Flowr brand and logo in the Google Sign-In overlay:

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your Flowr application project.
3. Navigate to **APIs & Services > OAuth Consent Screen**.
4. Configure the following:
   - **App logo**: Upload your Flowr logo.
   - **App Domain**:
     - **Application homepage**: `https://flowr.website`
     - **Application privacy policy link**: `https://flowr.website/privacy`
     - **Application terms of service link**: `https://flowr.website/terms`
   - **Authorized domains**: Add `flowr.website` to the list.
5. Save your settings. Google may take 1-3 days to verify the logo change for production users, but it will work immediately for your registered test/developer accounts.

---

## Step 2: Register the New Redirect callback in Google credentials

1. Navigate to **APIs & Services > Credentials** in the Google Cloud Console.
2. Select and edit your Web Client ID under **OAuth 2.0 Client IDs**.
3. Under **Authorized redirect URIs**, add this exact callback:
   `https://flowr.website/auth/v1/callback`
4. Keep the old `https://qmufalwubepttjxehvit.supabase.co/auth/v1/callback` in the list temporarily so both work during transition.
5. Save the credentials.

---

## Step 3: Register the New Redirect callback in Supabase

1. Open your **Supabase Project Dashboard**.
2. Navigate to **Authentication > Redirect URIs** (under URL Configuration).
3. Add the new callback route:
   `https://flowr.website/auth/v1/callback`
4. Click **Save**.

---

## Step 4: Update Environment Variables

To activate the proxy domain routing:

1. Open your local [.env file](file:///Users/mktsoy/Dev/flowr-app/.env) and change `NEXT_PUBLIC_SUPABASE_URL`:
   ```env
   # Local Development
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:3000
   ```
2. In your production hosting environment settings (e.g., **Vercel Project Dashboard > Settings > Environment Variables**):
   - Locate `NEXT_PUBLIC_SUPABASE_URL` and change its value to:
     `https://flowr.website`
3. Redeploy or restart your server to apply the changes.
