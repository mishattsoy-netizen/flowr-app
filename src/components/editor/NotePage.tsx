import { Entity } from '@/data/store';
import { NoteEditor } from './NoteEditor';

export function NotePage({ entity, isLoading }: { entity: Entity; isLoading?: boolean }) {
  return <NoteEditor entity={entity} isLoading={isLoading} />;
}

