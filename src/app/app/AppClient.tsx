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
const Shell = dynamic(
  () => import('@/components/layout/Shell').then(m => m.Shell),
  { ssr: false },
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
