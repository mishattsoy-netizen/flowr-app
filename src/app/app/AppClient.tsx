"use client";

import dynamic from 'next/dynamic';

// The /app interior is rendered client-only (ssr: false) on purpose.
//
// The server has no access to the user's localStorage, so a server render can
// only ever guess at the user's real state (which page was open, which tabs,
// whether split view was on, what the chat messages were). That guess is
// always wrong for anyone with existing data, producing a frame of incorrect
// UI that then snaps to the correct UI once the client takes over. Every
// "wrong thing flashes on refresh" bug traced back to that frame.
//
// Nothing under /app needs SSR: this route fetches no server-side data. Its
// only server-side work was reading a cookie the client itself had written,
// to guess what the client already knew.
//
// Because the Zustand store's persist adapter reads localStorage
// synchronously, a client-only first render already has the real data
// available — so there is no guess and nothing to snap.
//
// `ssr: false` is only permitted inside a Client Component in the App Router,
// which is the only reason this wrapper file exists.
/**
 * Shown only while the app's JavaScript chunk is downloading, before any app
 * code exists on the page.
 *
 * This deliberately contains ONLY the app's outer frame — a sidebar-width
 * column and a header strip — and no content whatsoever.
 *
 * That is not an oversight. At this point nothing about the user is known:
 * not their open page, tabs, split view, sidebar tree, or content. Anything
 * resembling content here would be a guess, and a wrong guess produces
 * exactly the "wrong UI appears then snaps to the real thing" flash that
 * rendering this route client-only was meant to eliminate. Only draw things
 * that are identical for every user on every page.
 *
 * Do not add skeleton rows, cards, icons, or placeholder text here.
 */
function AppFrameFallback() {
  return (
    <div className="flex flex-col h-screen w-full bg-[var(--app-dark)]">
      {/* Header strip */}
      <div className="w-full shrink-0" style={{ height: 42 }} />
      {/* Sidebar column + main area */}
      <div className="flex-1 flex flex-row min-h-0 w-full">
        <div
          className="h-full shrink-0"
          style={{ width: 'var(--sidebar-w, 280px)' }}
        />
        <div className="flex-1 h-full min-w-0" />
      </div>
    </div>
  );
}

const Shell = dynamic(
  () => import('@/components/layout/Shell').then(m => m.Shell),
  { ssr: false, loading: () => <AppFrameFallback /> },
);

const WorkspaceRouter = dynamic(
  () => import('@/components/WorkspaceRouter').then(m => m.WorkspaceRouter),
  { ssr: false },
);

export function AppClient({ initialEntityId }: { initialEntityId?: string }) {
  return (
    <Shell initialEntityId={initialEntityId}>
      <WorkspaceRouter initialEntityId={initialEntityId} />
    </Shell>
  );
}
