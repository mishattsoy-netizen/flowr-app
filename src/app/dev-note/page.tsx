"use client";
// TEMPORARY dev-only harness for driving NoteEditor in a browser without auth.
// Mirrors src/app/dev-canvas/page.tsx. Used to verify the cross-block-selection
// branch (feat/note-editor-selection) headlessly. Renders nothing in production
// builds. Delete before this branch is done.
import { useEffect, useState } from 'react';
import { NoteEditor } from '@/components/editor/NoteEditor';
import { useStore } from '@/data/store';
import type { Entity } from '@/data/store.types';

const DEV_ENTITY: Entity = {
  id: 'dev-note-fixture',
  title: 'Dev Note',
  type: 'note',
  parentId: null,
  lastModified: 0,
  pairedEntityId: null,
  syncMode: 'local-only',
  content: [
    { id: 'blk-title', type: 'text', style: 'title', content: 'My Great Title' },
    { id: 'blk-body', type: 'text', style: 'body', content: 'Some paragraph text here' },
    { id: 'blk-sub', type: 'text', style: 'subheading', content: 'Another subheading' },
    {
      id: 'blk-list', type: 'bulletList', content: '',
      children: [
        { id: 'blk-list-row1', type: 'bulletList', content: 'First bullet row' },
        { id: 'blk-list-row2', type: 'bulletList', content: 'Second bullet row' },
      ],
    },
  ] as any,
};

export default function DevNotePage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    useStore.setState((state) => ({
      entities: state.entities.some(e => e.id === DEV_ENTITY.id)
        ? state.entities
        : [...state.entities, DEV_ENTITY],
    }));
    (window as any).__store = useStore; // debug access for the driver
    setReady(true);
  }, []);
  // Subscribe reactively, exactly like EntityPageRenderer does — a static
  // entity object here previously masked a real persistence bug: entity.content
  // must update live from the store or NoteEditor's external-update sync effect
  // reverts freshly typed blocks back to the object's original snapshot.
  const entity = useStore(state => state.entities.find(e => e.id === DEV_ENTITY.id)) ?? DEV_ENTITY;
  if (process.env.NODE_ENV === 'production') return null;
  if (!ready) return null;
  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--app-background)]">
      <NoteEditor entity={entity} />
    </div>
  );
}
