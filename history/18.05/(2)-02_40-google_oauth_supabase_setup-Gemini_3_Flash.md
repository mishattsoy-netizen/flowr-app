# Request History Report: Google OAuth Supabase Setup Guide

### 0. Date and Time of the Request
- **Date**: 18.05.2026
- **Time**: 02:40 (Local Time: 02:40:00+03:00)

### 1. User Request
User request: "what should i use for google provider slect in the supabase?"

### 2. Objective Reconstruction
- Provide a clear, actionable, step-by-step guide for setting up Google OAuth (Client ID and Client Secret) inside the Supabase Auth Dashboard, using the Google Cloud Console credentials and matching the Callback URL provided by Supabase.

### 3. Strategic Reasoning
- The user is configuring Google Sign-in on the Supabase authentication settings panel.
- To resolve the required "Client IDs" and "Client Secret" errors, the user needs to create an OAuth 2.0 Client ID in the Google Cloud Console and whitelist the unique Supabase Callback URL shown in their screenshot.
- Providing high-fidelity steps ensures zero-misconfiguration errors when completing the integration.

### 4. Detailed Blueprint
- Step 1: Set up Google Cloud Console (Project, OAuth Consent, Web Client ID).
- Step 2: Whitelist authorized redirect URIs using the copied Supabase callback: `https://qmufalwubepttjxehvit.supabase.co/auth/v1/callback`.
- Step 3: Populate the Supabase dashboard fields and save.

### 5. Operational Trace
- Analyzed the screenshot to extract the exact callback URL.
- Structured a step-by-step configuration plan matching Google Cloud Console and Supabase input fields.
- Saved the trace in the history logs.

### 6. Status Assessment
- **Status**: 100% Completed
