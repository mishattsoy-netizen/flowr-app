import { describe, it, expect } from 'vitest';
import { markSelfDeleted, consumeSelfDeleteEcho } from './sync';

describe('self-originated DELETE echo suppression', () => {
  it('suppresses a realtime DELETE echo for an id we just deleted ourselves', () => {
    // Simulates toggling cloud sync OFF: we delete the row, Supabase echoes it back.
    markSelfDeleted('ws-root-1');
    expect(consumeSelfDeleteEcho('ws-root-1')).toBe(true);
  });

  it('does NOT suppress a delete we did not originate (genuine remote delete)', () => {
    // Another device deleted this entity — must propagate to local store.
    expect(consumeSelfDeleteEcho('entity-from-other-device')).toBe(false);
  });

  it('only suppresses the echo once, so a later real remote delete still applies', () => {
    markSelfDeleted('entity-2');
    expect(consumeSelfDeleteEcho('entity-2')).toBe(true);  // our echo, ignored
    expect(consumeSelfDeleteEcho('entity-2')).toBe(false); // later real delete, applied
  });

  it('does not suppress a stale self-delete record older than the TTL window', () => {
    markSelfDeleted('entity-3');
    // Echo arriving 11s later (TTL is 10s) is treated as a genuine remote delete.
    const elevenSecondsLater = Date.now() + 11_000;
    expect(consumeSelfDeleteEcho('entity-3', elevenSecondsLater)).toBe(false);
  });

  it('suppresses a task delete echo (disabling cloud sync deletes a workspace task)', () => {
    // Tasks share the same self-delete tracking as entities/spaces.
    markSelfDeleted('task-42');
    expect(consumeSelfDeleteEcho('task-42')).toBe(true);
  });
});
