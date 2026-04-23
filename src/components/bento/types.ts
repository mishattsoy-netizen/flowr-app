// BentoLayoutItem — row-based model (3-column, 4-row grid)
// Internal precision: 6 half-columns (so w can be 2, 3, 4, or 6)

export interface BentoLayoutItem {
  i: string;      // unique instance UUID
  type: string;   // key in widget registry
  row: number;    // 0–3 (max 4 rows)
  order: number;  // position within row: 0, 1, or 2
  w: number;      // width in half-columns: 2 (1col), 3 (1.5col), 4 (2col), 6 (3col/full)
  h: number;      // height in rows: 1–4
  data?: any;     // persistent widget configuration
}

// Row invariant: for every row index r,
//   sum of w for all items where item.row <= r < item.row + item.h = 6

export interface BentoLayout {
  items: BentoLayoutItem[];
  rowHeights: number[]; // v-units for each of the 4 rows (default: 6)
}
