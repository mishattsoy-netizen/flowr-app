User request: "also when i log out and gress log in with google agin i cant choose account i login in same one instantly. also when i logout instantly hide app, show login apge so i cant acces the content without acount"

### 0. Date and time of the request
- Date: 2026-06-06
- Time: 03:27

### 1. User request
"also when i log out and gress log in with google agin i cant choose account i login in same one instantly. also when i logout instantly hide app, show login apge so i cant acces the content without acount"

### 2. Objective Reconstruction
Modify the authentication behavior to:
1. Force Google account selection when signing in (instead of automatically logging into the previous account).
2. Instantly hide all protected application pages and redirect the user to `/login` immediately upon logout or unauthenticated access, preventing any flash or exposure of user content.

### 3. Strategic Reasoning
- **Forcing Account Selection**: Passed the `prompt: 'select_account'` query parameter into the Supabase `signInWithOAuth` options.
- **Instant Logout Redirection and Content Hiding**: Next.js middleware only intercepts server-side requests. Client-side authentication changes do not automatically trigger routing or UI updates unless client-side state is checked. We added client-side routing logic in `AuthProvider.tsx` to automatically watch the `user` and `loading` state. If the user is unauthenticated on a protected route (`/`, `/app`, `/admin`, or `/welcome`), the component renders a blank layout (preventing any visual flash of components or local Zustand data) and triggers `router.push('/login')` instantly. We also stored a guest flag in `sessionStorage` to preserve the optional development `guest=1` bypass.

### 4. Detailed Blueprint
- Modify `src/components/AuthProvider.tsx`:
  - Add `useRouter` and `usePathname` from `next/navigation`.
  - Add `prompt: 'select_account'` to `signInWithGoogle`.
  - Add `router.push('/login')` to `signOut` and clean up guest flags.
  - Implement a `useEffect` route guard to push to `/login` if a logged-out user is on a protected route.
  - Check if the route is protected, and if unauthenticated, return a blank container.

### 5. Operational Trace
1. **Inspected `AuthProvider.tsx`**: Reviewed existing auth state management.
2. **Updated `AuthProvider.tsx`**:
   - Added imports for Next.js navigation hooks.
   - Initialized `isGuest` using `sessionStorage` to handle guest bypass gracefully.
   - Updated `signInWithGoogle` to pass `queryParams: { prompt: 'select_account' }`.
   - Updated `signOut` to clean up `sessionStorage` and push to `/login`.
   - Added `isProtectedPath` matching rules.
   - Implemented route guard `useEffect` to redirect to `/login` when unauthenticated on a protected path.
   - Wrapped rendering to return `<div className="h-screen w-screen bg-[#0a0a0a]" />` immediately under unauthenticated access, hiding the app shell before redirection.
3. **Validated compiler safety**: Ran `npx tsc --noEmit` which completed successfully with zero compilation or syntax errors.
4. **Ran tests**: Executed unit tests which passed for all primary source code directories.

### 6. Status Assessment
- **Status**: Completed.
- **Outcome**: The authentication flow now forces Google account selection and handles logout client-side, instantly shielding all application content from unauthenticated access.
