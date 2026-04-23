import { supabase } from './supabase';
import type { BentoLayoutItem, BentoLayout } from '@/components/bento/types';
import { rebalanceAll, compactLayout } from './bento-engine';

const DEFAULT_ROW_HEIGHTS = [6, 6, 6, 6];

// ─── Legacy Format Detection & Migration ──────────────────────────────────────
// Old format: { i, type, x, y, w, h, data }  (6-column free-form grid)
// New format: { i, type, row, order, w, h, data }  (3-column row-based grid, 6 half-cols)

interface LegacyItem {
  i: string;
  type: string;
  x: number;
  y: number;
  w: number;  // was 1–6 columns on a 6-col grid
  h: number;
  data?: any;
}

function isLegacyFormat(items: any[]): items is LegacyItem[] {
  return items.length > 0 && 'x' in items[0] && !('row' in items[0]);
}

// Scale old 6-col width to new half-col units (6 half-cols = 3 visible cols)
// Old 1-col → 2 half-cols (1 visible col)
// Old 2-col → 2 half-cols (1 visible col, minimum)
// Old 3-col → 3 half-cols (1.5 visible col)
// Old 4-col → 4 half-cols (2 visible col)
// Old 5-col → 4 half-cols (2 visible col, rounds down)
// Old 6-col → 6 half-cols (full width)
function scaleWidth(oldW: number): number {
  if (oldW <= 2) return 2;
  if (oldW === 3) return 3;
  if (oldW <= 5) return 4;
  return 6;
}

export function migrateLegacyLayout(items: any[]): BentoLayoutItem[] {
  if (!isLegacyFormat(items)) return items as BentoLayoutItem[];

  // Group by y (old row index), cap at row 3
  const rowMap = new Map<number, LegacyItem[]>();
  for (const item of items) {
    const row = Math.min(item.y, 3);
    if (!rowMap.has(row)) rowMap.set(row, []);
    rowMap.get(row)!.push(item);
  }

  const migrated: BentoLayoutItem[] = [];

  rowMap.forEach((rowItems, row) => {
    // Sort by x within each row to determine order
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);

    // Limit to 3 widgets per row
    const capped = sorted.slice(0, 3);

    // Convert widths and assign order
    const converted = capped.map((item, order) => ({
      i: item.i,
      type: item.type,
      row,
      order,
      w: scaleWidth(item.w),
      h: Math.min(Math.max(item.h, 1), 4),
      data: item.data,
    }));

    // Rebalance is handled globally at the end
    migrated.push(...converted);
  });

  // Apply true engine balancing to ensure spanners are accounted for, then compact
  return compactLayout(rebalanceAll(migrated));
}

// ─── Load / Save ──────────────────────────────────────────────────────────────

export async function loadBentoLayout(contextId: string): Promise<BentoLayout | null> {
  const localKey = `bento-layout-${contextId}`;

  const parseAndMigrate = (json: any): BentoLayout => {
    // Check if it's the new object format { items, rowHeights }
    if (json && !Array.isArray(json) && 'items' in json) {
      return {
        items: migrateLegacyLayout(json.items),
        rowHeights: json.rowHeights || DEFAULT_ROW_HEIGHTS
      };
    }
    // Otherwise it's the old array format
    return {
      items: migrateLegacyLayout(Array.isArray(json) ? json : []),
      rowHeights: DEFAULT_ROW_HEIGHTS
    };
  };

  if (!supabase) {
    const local = localStorage.getItem(localKey);
    if (!local) return null;
    const parsed = JSON.parse(local);
    const layout = parseAndMigrate(parsed);
    // If migration changed format, save immediately
    if (isLegacyFormat(parsed) || Array.isArray(parsed)) {
      localStorage.setItem(localKey, JSON.stringify(layout));
    }
    return layout;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) {
    const local = localStorage.getItem(localKey);
    if (!local) return null;
    const parsed = JSON.parse(local);
    const layout = parseAndMigrate(parsed);
    if (isLegacyFormat(parsed) || Array.isArray(parsed)) {
      localStorage.setItem(localKey, JSON.stringify(layout));
    }
    return layout;
  }

  const { data, error } = await supabase
    .from('bento_layouts')
    .select('layout')
    .eq('user_id', user.id)
    .eq('context_id', contextId)
    .maybeSingle();

  if (error || !data) {
    const local = localStorage.getItem(localKey);
    if (!local) return null;
    const parsed = JSON.parse(local);
    return parseAndMigrate(parsed);
  }

  return parseAndMigrate(data.layout);
}

export async function saveBentoLayout(contextId: string, items: BentoLayoutItem[], rowHeights: number[]): Promise<void> {
  const localKey = `bento-layout-${contextId}`;
  const layout = { items, rowHeights };
  localStorage.setItem(localKey, JSON.stringify(layout));

  if (!supabase) return;
  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('bento_layouts')
    .upsert(
      { user_id: user.id, context_id: contextId, layout, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,context_id' }
    );

  if (error) console.error('[Bento] saveBentoLayout:', error.message);
}
