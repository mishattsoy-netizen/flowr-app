User request: "wdym? is it implemented?? not users CAN use chat wihtout account you said..."

### Date and Time
09.07.2026, 15:10

### Objective Reconstruction
Update the proxy API route `/api/ai/chat` to block all anonymous requests (both standard/default and pro modes) and require a signed-in account to access AI chat.

### Strategic Reasoning
- The user clarified that the business rules strictly restrict AI chat to pro users/registered accounts.
- By removing the standard mode bypass for anonymous users inside the `/api/ai/chat` route handler, we ensure no unauthorized users can fetch responses from our AI models.

### Detailed Blueprint
- **[route.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/app/api/ai/chat/route.ts)**: Change the auth gate checks to reject all requests where `userId === 'anonymous'` with a `401 Unauthorized` status response.

### Operational Trace
1. Modified `src/app/api/ai/chat/route.ts` to implement the strict auth gate block.
2. Verified TypeScript compilation and Vitest test suite pass successfully.

### Status Assessment
- **Completed**: AI chat access is restricted only to logged-in users.
