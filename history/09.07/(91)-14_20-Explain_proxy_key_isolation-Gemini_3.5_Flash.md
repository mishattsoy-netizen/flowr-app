User request: "so this way it fetches supabase key frm vercel?"

### 2. Objective Reconstruction
Clarify how the proxy handles sensitive keys. Explain that the desktop app does not fetch the Supabase service role key from Vercel; rather, the Vercel backend uses its own key internally to perform database and AI queries, ensuring the key never travels to the client.

### 3. Strategic Reasoning
Address the security mechanism: explain key isolation. The client receives only the plain-text model output stream, never the administrative keys or AI credentials.

### 4. Detailed Blueprint
- Explain backend execution vs key extraction.
- Detail the data flow.

### 5. Operational Trace
1. Wrote the response explaining proxy execution isolation.

### 6. Status Assessment
The user has been fully informed. No changes to the codebase were made.
