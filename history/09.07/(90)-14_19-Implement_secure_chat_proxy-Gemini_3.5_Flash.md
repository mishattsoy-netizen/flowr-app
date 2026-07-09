User request: "approved implementation plan"

### 2. Objective Reconstruction
Implement the approved secure proxy mechanism in `src/app/api/ai/chat/route.ts` to route chat requests to the remote hosted server when `SUPABASE_SERVICE_ROLE_KEY` is not present.

### 3. Strategic Reasoning
When running in a packaged desktop app, we cannot bundle the secret `SUPABASE_SERVICE_ROLE_KEY` without making it vulnerable to extraction. By proxying the requests from the local server to the remote hosted backend (`https://www.flowr.website/api/ai/chat`), we can safely execute LLM chains using centralized keys stored in the cloud. We forward the request body and headers (especially the `Authorization` header containing the user's login JWT) so the remote server can securely verify user quota rules and identity.

### 4. Detailed Blueprint
- Modify `src/app/api/ai/chat/route.ts` inside the `POST` handler.
- If `process.env.SUPABASE_SERVICE_ROLE_KEY` is undefined, rewrite the incoming request and pipe the stream from the remote server back to the desktop application.

### 5. Operational Trace
1. Injected the proxy check `const isDesktopAppProxy = typeof window === 'undefined' && !process.env.SUPABASE_SERVICE_ROLE_KEY` at the start of `POST` in `src/app/api/ai/chat/route.ts`.
2. Implemented `fetch` to `https://www.flowr.website/api/ai/chat` forwarding request body, headers, and signal.
3. Returned a `NextResponse` using the remote response's `ReadableStream` body to stream chunks to the client.
4. Ran compilation and unit checks to verify changes.

### 6. Status Assessment
The secure proxy fallback is fully implemented and tested. Packaged desktop apps will now securely delegate chat execution to the hosted cloud backend, completely preventing the "System Overload" database error.
