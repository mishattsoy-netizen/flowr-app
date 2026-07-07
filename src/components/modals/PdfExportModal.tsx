"use client";

import { useStore, EditorBlock } from '@/data/store';
import { X, Plus, Minus, ChevronDown, ArrowDown, ArrowRight } from 'lucide-react';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Toggle } from '../ui/Toggle';
import { cn } from '@/lib/utils';
import { blocksToExportHtml, escapeHtml } from '@/lib/editor/blocksToExportHtml';

const PAGE_MARGIN_MM = 15;

// Fallbacks mirror globals.css's --export-* tokens in case the stylesheet hasn't loaded yet
// (or an old cached build lacks them) - keeps the export from silently rendering unstyled.
const EXPORT_TOKEN_FALLBACKS: Record<string, string> = {
  '--export-text-light': '#111111',
  '--export-text-dark': '#f5f5f5',
  '--export-page-bg-light': '#ffffff',
  '--export-page-bg-dark': '#111111',
  '--export-chrome-border-light': 'rgba(0,0,0,0.22)',
  '--export-chrome-border-dark': 'rgba(255,255,255,0.24)',
  '--export-chrome-bg-light': 'rgba(0,0,0,0.06)',
  '--export-chrome-bg-dark': 'rgba(255,255,255,0.09)',
  '--export-list-marker-light': '#5a5a5a',
  '--export-list-marker-dark': '#a8a8a8',
};

// Reads the fixed --export-* tokens from globals.css (:root, not .dark-scoped) so the export's
// own light/dark toggle stays in sync with a single source of truth designers can edit in one
// place, instead of duplicating colors here. These are deliberately NOT the app's --bone-*
// tokens: --bone-* flips with the app's current .dark class, but the export has its own
// independent theme toggle and must resolve correctly no matter what theme the app is in.
function readExportToken(name: string): string {
  if (typeof window === 'undefined') return EXPORT_TOKEN_FALLBACKS[name] ?? '';
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || EXPORT_TOKEN_FALLBACKS[name] || '';
}

// Per-element styling shared by the on-screen paged.js preview and the native Electron
// export path - both render the same blocksToExportHtml() markup and must look identical.
function buildContentCss(scope: string, isDark: boolean): string {
  const mode = isDark ? 'dark' : 'light';
  const linkColor = readExportToken(`--export-text-${mode}`);
  // Pills and tables share one "chrome" palette so they read with the same weight on the
  // page in both themes.
  const chromeBorder = readExportToken(`--export-chrome-border-${mode}`);
  const chromeBg = readExportToken(`--export-chrome-bg-${mode}`);
  const pillBg = chromeBg;
  const pillBorder = chromeBorder;
  const tableBorder = chromeBorder;
  const tableHeaderBg = chromeBg;
  const listMarker = readExportToken(`--export-list-marker-${mode}`);
  const listMarkerFaded = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  return `
    ${scope} a { color: ${linkColor}; text-decoration: underline; text-underline-offset: 2px; }
    /* Stored note content renders pills as .inline-link-btn (and .entity-pill from markdown),
       and the app's global .inline-link-btn rule styles them with the APP theme's var(--bone-*)
       tokens plus color:!important - since the preview shares the document, that rule wins
       unless overridden with !important here. Without this, pills followed the app theme
       instead of the export theme (invisible light pills in a dark app, and vice versa). */
    ${scope} a.entity-pill, ${scope} a.inline-link-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px;
      padding: 2px 8px !important;
      margin: 0 2px !important;
      background-color: ${pillBg} !important;
      border: 1px solid ${pillBorder} !important;
      border-radius: 9999px !important;
      font-weight: 700 !important;
      text-decoration: none !important;
      color: ${linkColor} !important;
    }
    ${scope} h1.pdf-export-title { font-size: 2.25rem; font-weight: 700; margin: 0 0 1em; opacity: 0.9; }
    ${scope} h1 { font-size: 1.75rem; font-weight: 700; margin: 1.5em 0 0.5em; }
    ${scope} h2 { font-size: 1.4rem; font-weight: 700; margin: 1.4em 0 0.5em; }
    ${scope} h3 { font-size: 1.15rem; font-weight: 600; margin: 1.2em 0 0.4em; }
    ${scope} p { margin: 0 0 0.75em; }
    /* Empty blocks in the note (blank lines the author left for spacing) render as empty
       <p>s, which have no line box and collapse to zero height - preserve them as a
       one-row gap so the exported PDF keeps the note's vertical rhythm. */
    ${scope} p:empty { min-height: 1.6em; }
    /* Tailwind preflight resets ol/ul { list-style: none } globally and this stylesheet
       lives in the same document as the app, so that reset otherwise silently strips
       every bullet/number in the export. */
    /* Lists replicate the editor's ListBlock geometry (see ListBlock.tsx marker()): text
       sits 26px after the row start (16px marker column + 10px gap) and each nesting level
       adds that same step via the parent li's padding; markers are tiny 5.5px shapes cycling
       filled circle -> hollow rounded square -> filled square by depth, in muted gray.
       Browser-default list markers look nothing like this, so ul markers are ::before dots
       and list-style is disabled. */
    ${scope} ul { margin: 0 0 0.75em; padding-left: 0; list-style: none; }
    ${scope} ol { margin: 0 0 0.75em; padding-left: 26px; list-style: decimal; }
    ${scope} ul ul, ${scope} ul ol, ${scope} ol ul, ${scope} ol ol { margin: 0; }
    ${scope} ul ul { padding-left: 0; }
    ${scope} ul > li { display: block; position: relative; padding: 2px 0 2px 26px; }
    ${scope} ol > li { display: list-item; padding: 2px 0; }
    ${scope} ol > li::marker { color: ${listMarkerFaded}; }
    ${scope} ol ol { list-style: lower-alpha; }
    ${scope} ol ol ol { list-style: lower-roman; }
    ${scope} ul > li::before { content: ''; position: absolute; left: 5px; top: 0.68em; width: 5.5px; height: 5.5px; background: ${listMarker}; border-radius: 50%; }
    ${scope} ul ul > li::before { background: transparent; border: 1px solid ${listMarker}; border-radius: 1.5px; }
    ${scope} ul ul ul > li::before { background: ${listMarker}; border: none; border-radius: 1px; }
    ${scope} ul ul ul ul > li::before { background: ${listMarker}; border: none; border-radius: 50%; }
    ${scope} ul.pdf-export-dashed > li::before { width: 8px; height: 1.5px; border: none; border-radius: 0; background: ${listMarker}; top: 0.85em; }
    ${scope} ul.pdf-export-dashed ul.pdf-export-dashed > li::before { width: 6px; }
    ${scope} blockquote { margin: 0 0 0.75em; padding-left: 1em; border-left: 3px solid currentColor; opacity: 0.85; }
    ${scope} hr { border: none; border-top: 1px solid currentColor; opacity: 0.3; margin: 1.5em 0; }
    ${scope} li.pdf-export-checklist-item { display: flex; gap: 0.5em; padding-left: 0; }
    ${scope} li.pdf-export-checklist-item::before { content: none; }
    ${scope} .pdf-export-table { display: table; width: 100%; border-collapse: collapse; margin: 0 0 0.75em; border: 1px solid ${tableBorder}; border-radius: 8px; overflow: hidden; }
    ${scope} .pdf-export-table thead { display: table-header-group; }
    ${scope} .pdf-export-table tbody { display: table-row-group; }
    ${scope} .pdf-export-table tr { display: table-row; }
    ${scope} .pdf-export-table th, ${scope} .pdf-export-table td { display: table-cell; border-bottom: 1px solid ${tableBorder}; border-right: 1px solid ${tableBorder}; padding: 0.5em 0.75em; text-align: left; }
    ${scope} .pdf-export-table th:last-child, ${scope} .pdf-export-table td:last-child { border-right: none; }
    ${scope} .pdf-export-table tr:last-child td { border-bottom: none; }
    ${scope} .pdf-export-table th { background-color: ${tableHeaderBg}; font-weight: 700; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.03em; }
    ${scope} .pdf-export-columns { display: flex; gap: 1em; }
    ${scope} .pdf-export-column { flex: 1; }
    /* 14px/1.625 matches the app's code blocks (chat + note mono blocks) - the export body
       is 16px, so without this code renders visibly larger than in the app. DM Mono first
       since that's the app's mono face; generic monospace as the print-safe fallback. */
    ${scope} .pdf-export-code { background: rgba(128,128,128,0.1); padding: 0.75em 1em; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 14px; line-height: 1.625; white-space: pre-wrap; }
    ${scope} .pdf-export-figure { margin: 0 0 0.75em; }
    ${scope} .pdf-export-figure img { max-width: 100%; }
  `;
}

// Opening zoom for the preview, and what the percentage pill resets to.
const DEFAULT_ZOOM = 0.67;

export function PdfExportModal() {
  const { modal, closeModal } = useStore();
  const [includeTitle, setIncludeTitle] = useState(true);
  const [pageSize, setPageSize] = useState<'A4' | 'square' | 'presentation'>('A4');
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [landscape, setLandscape] = useState(false);
  const [font, setFont] = useState<'sans' | 'serif'>('serif');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  // Which point of the page (as a 0..1 fraction of the outer box) should sit at the pane's
  // viewport center after a zoom change - captured before the change, applied by the layout
  // effect below once the resized box has been laid out. Without this, zooming visually
  // grows from the page's top-left (transform-origin: top left is required by the
  // scaled-box scroll-size pattern) instead of from the center of the current view.
  const pendingZoomCenter = useRef<{ fx: number; fy: number; zoom: number } | null>(null);
  const zoomOuterRef = useRef<HTMLDivElement>(null);
  // After a pagination run, scroll so the page's middle sits in the middle of the pane.
  // margin:auto only centers a page that FITS; at the default 67% an A4 page is slightly
  // taller than most panes, so it top-anchors (correct - keeps the top reachable) but reads
  // as "shifted down" until the scroll position is centered too.
  const pendingCenterScrollRef = useRef(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const pagesRenderTargetRef = useRef<HTMLDivElement>(null);
  const nativeExportRef = useRef<HTMLDivElement>(null);
  const paginationRunId = useRef(0);
  const [isPaginating, setIsPaginating] = useState(false);
  const isPaginatingRef = useRef(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const [pageThumbs, setPageThumbs] = useState<number[]>([]);
  const [activePage, setActivePage] = useState(0);
  // Natural (unscaled) size of one page, in CSS px. transform:scale() only affects paint,
  // not layout/scroll size - the pane would always think it needs to scroll for the full
  // ~794x1123 A4 box regardless of zoom unless the wrapper is given an explicit scaled size.
  const [pageNaturalSize, setPageNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const modalActive = !!modal && modal.kind === 'pdfExport';
  const blocks = modalActive ? (modal as any).blocks as EditorBlock[] : [];
  const entityTitle = modalActive ? (modal as any).entityTitle as string : '';

  let pageWidthMm = 210;
  let pageHeightMm = 297;
  let cssPageSize = 'A4';

  if (pageSize === 'square') {
    pageWidthMm = 210;
    pageHeightMm = 210;
    cssPageSize = '210mm 210mm';
  } else if (pageSize === 'presentation') {
    pageWidthMm = 297;
    pageHeightMm = 167;
    cssPageSize = '297mm 167mm';
  } else {
    if (landscape) {
      pageWidthMm = 297;
      pageHeightMm = 210;
      cssPageSize = 'A4 landscape';
    } else {
      pageWidthMm = 210;
      pageHeightMm = 297;
      cssPageSize = 'A4 portrait';
    }
  }

  // Load paged.js as a plain classic <script>, not an ES/CJS import. Its published dist
  // bundles an old legacy dependency chain (event-emitter -> d -> es5-ext) that breaks when
  // a bundler (webpack/Turbopack/Vite) re-parses the already-built file - the shim closures
  // get split across module boundaries and `contains.call` ends up undefined at runtime.
  // Running it as an untouched script tag (exposing window.Paged) sidesteps that entirely.
  const loadPagedScript = useCallback((): Promise<any> => {
    const w = window as any;
    if (w.Paged?.Previewer) return Promise.resolve(w.Paged);
    if (w.__pagedScriptPromise) return w.__pagedScriptPromise;

    w.__pagedScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/paged.js';
      script.async = true;
      script.onload = () => resolve(w.Paged);
      script.onerror = () => reject(new Error('Failed to load paged.js'));
      document.head.appendChild(script);
    });
    return w.__pagedScriptPromise;
  }, []);

  // Run paged.js against clean, semantic, read-only export markup built directly from the
  // block data (blocksToExportHtml) - not a clone of the interactive editor's BlockRenderer
  // tree. BlockRenderer renders drag handles, hover chrome, contentEditable, and deeply
  // nested flex wrappers meant for editing; feeding that DOM to paged.js's layout/fragmentation
  // engine caused reordered, duplicated, and dropped content. Plain <p>/<h1>/<ul>/<table>
  // markup is what a layout engine expects and needs no flex-flatten hacks at all.
  useEffect(() => {
    if (!modalActive) return;
    let cancelled = false;
    const runId = ++paginationRunId.current;

    const paginate = async () => {
      const outerTarget = pagesRenderTargetRef.current;
      if (!outerTarget) return;

      setIsPaginating(true);
      isPaginatingRef.current = true;
      setPaginationError(null);

      // Each run gets its own child mount so an overlapping/superseded run (React
      // StrictMode double-invoke, or a settings change firing before the previous run's
      // async preview() finished) can never append into a container another run is still
      // writing to - that interleaving is what caused reordered/duplicated/missing content.
      // The mount must be attached to the live document (off-screen) before preview() runs -
      // paged.js measures layout via getBoundingClientRect during rendering and throws on a
      // detached node. It's swapped into the visible target only once pagination succeeds.
      const mount = document.createElement('div');
      mount.className = 'pdf-pages-mount';
      mount.style.cssText = 'position:absolute; top:0; left:-99999px; visibility:hidden;';
      document.body.appendChild(mount);

      try {
        // Let layout/fonts settle before pagination so measured heights are final.
        await Promise.resolve((document as any).fonts?.ready).catch(() => {});
        await new Promise(requestAnimationFrame);

        if (cancelled || runId !== paginationRunId.current) return;

        const { Previewer } = await loadPagedScript();

        if (cancelled || runId !== paginationRunId.current) return;

        // Previewer's Polisher appends a <style> to document.head on every run and never
        // removes the previous one - clear stale ones so settings changes don't accumulate styles.
        document.head.querySelectorAll('style[data-pagedjs-inserted-styles]').forEach(el => el.remove());

        const contentHtml = blocksToExportHtml(blocks);
        const titleHtml = includeTitle ? `<h1 class="pdf-export-title">${escapeHtml(entityTitle)}</h1>` : '';

        const isDark = theme === 'dark';
        // Read the *actual* resolved font-family (next/font sets a hashed class on <html>;
        // its CSS var only reliably resolves by inheritance in the live document, not
        // necessarily inside paged.js's separately-parsed stylesheet pipeline) so the
        // literal font name is what we hand paged.js, not a variable it might not resolve.
        const probe = document.createElement('div');
        probe.style.cssText = `font-family: var(${font === 'serif' ? '--font-display' : '--font-sans'});`;
        document.body.appendChild(probe);
        const resolvedFontFamily = getComputedStyle(probe).fontFamily || (font === 'serif' ? 'serif' : 'sans-serif');
        probe.remove();

        const exportMode = isDark ? 'dark' : 'light';
        const pageBg = readExportToken(`--export-page-bg-${exportMode}`);
        const pageText = readExportToken(`--export-text-${exportMode}`);

        const stylesheet = `
          @page {
            size: ${pageWidthMm}mm ${pageHeightMm}mm;
            margin: ${PAGE_MARGIN_MM}mm;
          }
          .pagedjs_page {
            background-color: ${pageBg};
          }
          .pagedjs_page_content {
            color: ${pageText};
            font-family: ${resolvedFontFamily};
            letter-spacing: ${isDark ? '0.04em' : '-0.01em'};
            line-height: 1.6;
          }
          ${buildContentCss('.pagedjs_page_content', isDark)}
        `;

        const previewer = new Previewer();
        // Polisher.add() only treats a stylesheet arg as inline CSS text when it's an
        // object map ({ key: cssText }) - a plain string is instead treated as a URL to
        // XHR-fetch. Passing a raw CSS string directly made it try to GET the CSS text
        // itself as a path, which resolved to an unrelated page and broke pagination.
        await previewer.preview(`${titleHtml}${contentHtml}`, [{ 'pdf-export-inline': stylesheet }], mount);

        if (cancelled || runId !== paginationRunId.current) {
          mount.remove();
          return;
        }

        // Measure and mark the initial active page BEFORE the swap: the mount is still
        // off-screen with visibility:hidden, which preserves layout (offsetWidth is real),
        // but the instant it lands inside .pdf-pages-target the only-active-page-visible
        // CSS makes every non-active page display:none and it measures 0x0 - which
        // previously zeroed the wrapper (page painted off-center from a zero-size point,
        // no scrollbar) and killed the auto-fit (stuck at the default zoom).
        const pages = mount.querySelectorAll('.pagedjs_page');
        pages.forEach((p, i) => p.classList.toggle('pdf-active-page', i === 0));
        const firstPage = pages[0] as HTMLElement | undefined;
        const naturalW = firstPage?.offsetWidth ?? 0;
        const naturalH = firstPage?.offsetHeight ?? 0;

        mount.style.cssText = '';
        outerTarget.innerHTML = '';
        outerTarget.appendChild(mount);

        setPageThumbs(Array.from({ length: pages.length }));
        setActivePage(0);
        if (naturalW > 0 && naturalH > 0) {
          setPageNaturalSize({ w: naturalW, h: naturalH });
          pendingCenterScrollRef.current = true;
        }

        // The preview opens at the fixed default zoom (67%, per design preference) rather
        // than auto-fitting to the pane; fit-to-pane remains available via the zoom
        // controls' reset button.
      } catch (err) {
        mount.remove();
        if (cancelled || runId !== paginationRunId.current) return;
        console.error('PDF pagination failed:', err);
        setPaginationError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled && runId === paginationRunId.current) {
          setIsPaginating(false);
          isPaginatingRef.current = false;
        }
      }
    };

    paginate();

    return () => {
      cancelled = true;
    };
  }, [blocks, includeTitle, entityTitle, font, theme, pageWidthMm, pageHeightMm, modalActive, loadPagedScript]);

  // Zoom via ctrl/cmd + wheel; plain wheel/trackpad steps between pages one at a time
  // (Adobe-style paging) instead of free scrolling. The pane shows exactly one page at a
  // time, always centered - this sidesteps an entire class of bugs from the previous
  // continuous-scroll layout: centering content that can be larger than the pane on both
  // axes, and the on-screen "layout" toggle (vertical/horizontal) fighting a single scroll
  // container, both had no clean fix because a fully centered page never overflows both
  // sides of the pane at once, while a scrollable multi-page strip necessarily can.
  // All manual zoom changes go through this so the point of the page at the viewport
  // center stays at the viewport center: the page fraction under the center is captured
  // BEFORE the zoom state changes, and the layout effect below re-scrolls to it after the
  // resized box has been laid out. Without this, zoom visually grows from the page's
  // top-left corner (transform-origin: top left is required by the scaled-box pattern).
  const applyZoomCentered = useCallback((compute: (prev: number) => number) => {
    const pane = previewRef.current;
    const outer = zoomOuterRef.current;
    let pending: { fx: number; fy: number } | null = null;
    if (pane && outer) {
      const paneRect = pane.getBoundingClientRect();
      const outerRect = outer.getBoundingClientRect();
      if (outerRect.width > 0 && outerRect.height > 0) {
        pending = {
          fx: (paneRect.left + paneRect.width / 2 - outerRect.left) / outerRect.width,
          fy: (paneRect.top + paneRect.height / 2 - outerRect.top) / outerRect.height,
        };
      }
    }
    setZoom(prev => {
      const next = Math.max(0.1, Math.min(3, compute(prev)));
      // Setting a ref from inside an updater is safe here: it's idempotent, so React
      // double-invoking the updater (StrictMode) just writes the same value twice.
      if (next !== prev && pending) pendingZoomCenter.current = { ...pending, zoom: next };
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    const pane = previewRef.current;
    const outer = zoomOuterRef.current;
    const pending = pendingZoomCenter.current;
    if (!pane || !outer || !pending || pending.zoom !== zoom) return;
    pendingZoomCenter.current = null;
    const paneRect = pane.getBoundingClientRect();
    const outerRect = outer.getBoundingClientRect();
    // Scroll by however far the captured page-point has drifted from the viewport center.
    // Delta form (+=) is robust to the pane's padding and the wrapper's auto margins; the
    // browser clamps to the valid scroll range when the page still fits.
    pane.scrollLeft += (outerRect.left + pending.fx * outerRect.width) - (paneRect.left + paneRect.width / 2);
    pane.scrollTop += (outerRect.top + pending.fy * outerRect.height) - (paneRect.top + paneRect.height / 2);
  }, [zoom]);

  // Center the scroll position after each pagination run (see pendingCenterScrollRef).
  // Runs on the commit that renders the new pageNaturalSize, so the sized wrapper is
  // already laid out and scrollWidth/Height are final. No-op (0/2 = 0) when the page fits.
  useLayoutEffect(() => {
    if (!pendingCenterScrollRef.current) return;
    const pane = previewRef.current;
    if (!pane || !pageNaturalSize) return;
    pendingCenterScrollRef.current = false;
    pane.scrollLeft = (pane.scrollWidth - pane.clientWidth) / 2;
    pane.scrollTop = (pane.scrollHeight - pane.clientHeight) / 2;
  }, [pageNaturalSize]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;

    let wheelCooldown = false;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        applyZoomCentered(prev => prev - e.deltaY * 0.002);
        return;
      }
      e.preventDefault();
      if (wheelCooldown) return;
      const delta = layout === 'horizontal' ? (e.deltaX || e.deltaY) : e.deltaY;
      if (Math.abs(delta) < 12) return;
      wheelCooldown = true;
      setTimeout(() => { wheelCooldown = false; }, 220);
      setActivePage(prev => {
        const max = pageThumbs.length - 1;
        return Math.max(0, Math.min(max, prev + (delta > 0 ? 1 : -1)));
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [layout, pageThumbs.length, applyZoomCentered]);

  // Arrow keys step pages too, matching the Adobe Acrobat-style paging model.
  useEffect(() => {
    if (!modalActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowLeft') return;
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      setActivePage(prev => Math.max(0, Math.min(pageThumbs.length - 1, prev + (forward ? 1 : -1))));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modalActive, pageThumbs.length]);

  const scrollToPage = (index: number) => {
    setActivePage(Math.max(0, Math.min(pageThumbs.length - 1, index)));
  };

  // paged.js's page nodes aren't React elements, so which one is "active" (shown) has to be
  // applied as a plain DOM class rather than JSX props/conditional rendering.
  useEffect(() => {
    const pages = pagesRenderTargetRef.current?.querySelectorAll('.pagedjs_page');
    pages?.forEach((page, i) => {
      page.classList.toggle('pdf-active-page', i === activePage);
    });
  }, [activePage, pageThumbs]);

  if (!modalActive) return null;

  const handlePrint = async () => {
    // Guard against printing mid-pagination: window.print() reads whatever is currently
    // sitting in pagesRenderTargetRef, but paginate() only swaps the newly-built pages in
    // after its async preview() resolves. Clicking Export while a run is still in flight
    // (more likely on longer notes, since layout/measurement takes longer) printed stale or
    // empty page content - blank first page, missing title - even though the on-screen
    // preview went on to render correctly a moment later.
    if (isPaginating) {
      await new Promise<void>(resolve => {
        const check = () => {
          if (!isPaginatingRef.current) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });
    }

    const flowrPdf = (window as any).flowrPdf;
    const isElectron = (window as any).__FLOWR_DESKTOP__ && flowrPdf?.exportPdf;

    if (!isElectron) {
      // A scrolled preview pane can offset/clip what Chrome paints in print even though
      // print CSS overrides overflow - reset scroll so the print origin is the content top.
      // window.print() blocks until the dialog closes, so restoring right after is safe.
      const pane = previewRef.current;
      const prevScroll = pane ? { top: pane.scrollTop, left: pane.scrollLeft } : null;
      if (pane) { pane.scrollTop = 0; pane.scrollLeft = 0; }
      window.print();
      if (pane && prevScroll) { pane.scrollTop = prevScroll.top; pane.scrollLeft = prevScroll.left; }
      return;
    }

    // Electron's webContents.printToPDF does NOT reliably apply @media print CSS (it can
    // rasterize hidden/on-screen state rather than the print stylesheet - a documented
    // Electron limitation, not something fixable from page CSS). So the export path renders
    // separate, unpaginated content into a dedicated hidden container, toggled visible via
    // an unconditional class (not a media query) right before printToPDF runs, and lets
    // Chromium's native print pagination (preferCSSPageSize + @page) lay it out - the same
    // engine that already proved correct mid-block splitting in the on-screen paged.js path.
    const exportEl = nativeExportRef.current;
    if (!exportEl) return;

    const contentHtml = blocksToExportHtml(blocks);
    const titleHtml = includeTitle ? `<h1 class="pdf-export-title">${escapeHtml(entityTitle)}</h1>` : '';
    exportEl.innerHTML = `${titleHtml}${contentHtml}`;

    document.body.classList.add('pdf-exporting');
    // Wait two frames so the browser actually paints the now-visible export container
    // before printToPDF snapshots it - a single rAF can still race the paint.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    try {
      const result = await flowrPdf.exportPdf({
        defaultFileName: `${entityTitle || 'export'}.pdf`,
        pageWidthMicrons: pageWidthMm * 1000,
        pageHeightMicrons: pageHeightMm * 1000,
      });
      if (result && !result.canceled && !result.filePath) {
        setPaginationError('PDF export failed - no file was saved.');
      }
    } finally {
      document.body.classList.remove('pdf-exporting');
      exportEl.innerHTML = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  };

  return createPortal(
    <>
      <style>{`
        /* paged.js renders every .pagedjs_page into this container up front (sizing/margins
           come from the @page rule we hand to the Previewer, so every page - incl. mid-block
           splits - matches), but the preview only ever shows one at a time: only .pdf-active-page
           is visible, toggled by the activePage effect below as the user pages through via the
           nav strip, wheel, or arrow keys. "Layout" (vertical/horizontal) no longer arranges a
           visible multi-page strip - it only picks which wheel axis pages (deltaY vs deltaX),
           since a single always-centered page can't overflow both pane axes at once the way a
           continuously scrollable strip could, which is what made both centering and the zoom
           controls fight every combination of zoom/layout/scroll position. */
        .pdf-pages-target .pagedjs_pages {
          display: flex;
        }
        .pdf-pages-target .pagedjs_page {
          display: none;
        }
        .pdf-pages-target .pagedjs_page.pdf-active-page {
          display: block;
        }
        .pdf-pages-target .pagedjs_page {
          box-shadow: 0 10px 40px rgba(0,0,0,0.25);
          flex-shrink: 0;
        }

        @media print {
          /* display:none (not visibility:hidden) so hidden elements contribute zero layout
             box - visibility:hidden keeps the app's full-page layout (sidebar, editor, etc.)
             occupying height/page area behind the modal, which prints as a leading blank page. */
          body > *:not(.pdf-modal-container) {
            display: none !important;
          }
          .pdf-modal-container {
            /* On screen this is a fixed, full-viewport flex box that centers the modal.
               All three of those properties break print for multi-page notes: inset-0's
               bottom pin clamps the box to one viewport of height, and flex centering then
               pushes the top of taller-than-viewport content ABOVE y=0 - so the title and
               first page sat above the print origin (blank first sheet, no title) while
               short notes, which fit inside one viewport, printed fine. */
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            right: auto !important;
            bottom: auto !important;
            width: 100% !important;
            height: auto !important;
          }
          .pdf-modal-container > *:not(.pdf-modal-panel) {
            display: none !important;
          }
          .pdf-modal-panel > *:not(.pdf-preview-pane) {
            display: none !important;
          }
          /* Ancestor containers clip by box geometry regardless of visibility - the modal
             panel and preview pane are fixed-height/overflow:hidden|auto for on-screen use,
             which would silently truncate the exported PDF to whatever fit on screen. */
          /* The panel (flex row) and preview pane (flex column) must also drop flex in
             print - Chromium's print engine fragments content inside flex formatting
             contexts unreliably, and any leftover flex alignment can offset content. */
          .pdf-modal-panel {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .pdf-preview-pane {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
          }
          .pdf-preview-pane > *:not(.pdf-zoom-outer) {
            display: none !important;
          }
          /* .pdf-zoom-outer's explicit width/height (set inline, in JS, from the current
             on-screen zoom level) and .pdf-zoom-wrapper's scale transform both exist purely
             so the preview's scrollbar tracks zoom correctly - neither should affect the
             actual print output, which must always be at the page's true, unscaled size
             regardless of whatever zoom % the preview happened to be at. */
          .pdf-zoom-outer {
            width: auto !important;
            height: auto !important;
            margin: 0 !important;
          }
          .pdf-zoom-wrapper {
            width: auto !important;
            height: auto !important;
            transform: none !important;
          }
          .pdf-pages-target {
            position: relative !important;
            transform: none !important;
          }
          .pdf-pages-target .pagedjs_pages {
            gap: 0 !important;
            /* Print is inherently a single vertical sheet feed regardless of the on-screen
               layout choice. display:flex itself (not just flex-direction) makes Chrome's
               real print engine treat break-after:page on the flex items as unreliable -
               it can drop/misplace page breaks, producing a blank leading sheet and content
               shifted off the first page. Plain block layout lets each .pagedjs_page's
               break-after map 1:1 to a physical sheet. */
            display: block !important;
          }
          .pdf-pages-target .pagedjs_page {
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
            /* Browsers drop background colors on print by default; without this the
               dark theme's page background silently prints white. */
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          .pdf-pages-target .pagedjs_page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          /* paged.js already sizes each .pagedjs_page box (incl. its margin boxes)
             from the @page rule we gave the Previewer, so the browser's own
             page box must add no extra size/margin of its own. */
          @page {
            size: ${cssPageSize};
            margin: 0;
          }
        }

        /* Electron's printToPDF doesn't reliably apply @media print (documented Electron
           limitation), so the native-export path can't rely on a media query to swap content
           in/out. This unconditional class is toggled by JS immediately before/after
           printToPDF runs instead. Un-paginated: Chromium's native print engine (invoked by
           printToPDF) paginates this content itself via @page below. */
        .pdf-native-export {
          display: none;
        }
        body.pdf-exporting > *:not(.pdf-native-export) {
          display: none !important;
        }
        body.pdf-exporting .pdf-native-export {
          display: block !important;
          position: static;
          color: ${readExportToken(`--export-text-${theme}`)};
          background-color: ${readExportToken(`--export-page-bg-${theme}`)};
          font-family: ${font === 'serif' ? 'var(--font-display)' : 'var(--font-sans)'};
          letter-spacing: ${theme === 'dark' ? '0.04em' : '-0.01em'};
          line-height: 1.6;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        ${buildContentCss('body.pdf-exporting .pdf-native-export', theme === 'dark')}
      `}</style>

      {/* Hidden except during a native Electron export - see handlePrint / .pdf-exporting.
          The `body.pdf-exporting > *:not(...)` CSS rule hides body's direct children, so
          this must actually be one - the whole modal is portaled to document.body (below)
          specifically so this and .pdf-modal-container both land as direct body children,
          instead of nested under Shell/providers where display:none on an ancestor would
          kill this subtree regardless of its own display:block override. */}
      <div ref={nativeExportRef} className="pdf-native-export" />

      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay pdf-modal-container" onClick={closeModal} onKeyDown={handleKeyDown}>
        <div
          className="pdf-modal-panel relative bg-panel border border-[var(--bone-6)] rounded-[1.25rem] w-full max-w-5xl h-[80vh] flex overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Page navigation strip - lists every laid-out page; click to jump straight to it.
              pageThumbs is just a length placeholder (paged.js's real .pagedjs_page nodes live
              outside React's tree), set once per pagination run when the page count becomes
              known - see the mount-swap step in the pagination effect above. */}
          <div className="w-16 border-r border-[var(--bone-6)] shrink-0 overflow-y-auto py-3 flex flex-col items-center gap-2 bg-sidebar">
            {pageThumbs.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollToPage(i)}
                className={cn(
                  "w-9 aspect-[210/297] rounded-[3px] border text-[9px] font-semibold flex items-center justify-center transition-colors shrink-0",
                  activePage === i
                    ? "bg-[var(--app-dark)] border-[var(--bone-30)] text-[var(--bone-100)]"
                    : "bg-panel border-[var(--bone-10)] text-[var(--bone-60)] hover:border-[var(--bone-30)] hover:text-[var(--bone-90)]"
                )}
                title={`Page ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {/* Preview Pane - centering comes from margin:auto on the child, NOT from
              items-center/justify-center on this container. Container-driven flex centering
              distributes overflow symmetrically past both edges, and scroll position can't go
              negative, so the start side (the page top when zoomed in) becomes permanently
              unreachable - "can scroll to the bottom but get stuck before the top". Auto
              margins center the child only when free space exists and resolve to zero once
              the child overflows, keeping the whole page reachable at any zoom. */}
          <div
            ref={previewRef}
            className="pdf-preview-pane flex-1 relative overflow-auto p-8 flex bg-[var(--bone-2)]"
          >
            {isPaginating && !paginationError && (
              <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[205]">
                <div className="px-3 py-1.5 rounded-full bg-panel/90 border border-[var(--bone-6)] text-[11px] text-muted-foreground shadow-lg">
                  Laying out pages…
                </div>
              </div>
            )}

            {paginationError && (
              <div className="fixed inset-0 flex items-center justify-center z-[205] p-8">
                <div className="max-w-md px-4 py-3 rounded-[10px] bg-panel border border-red-500/30 text-[12px] text-red-500 shadow-lg">
                  <p className="font-semibold mb-1">Couldn't lay out the preview</p>
                  <p className="text-muted-foreground break-words">{paginationError}</p>
                </div>
              </div>
            )}

            {/* transform:scale() only affects paint, not layout - the outer box below stays
                the page's true (unscaled) ~794x1123px size regardless of zoom, so the pane's
                overflow:auto always thought it needed to scroll even when the visually
                scaled-down page fit fine, and the scrollbar never adapted to zoom level.
                Fixed by giving the outer box an explicit *scaled* width/height (so it
                participates correctly in the pane's layout/scroll-size math) and putting the
                transform on an inner element sized to the natural dimensions with
                transform-origin: top left, the standard zoom-canvas pattern. Falls back to
                unsized (old behavior) only before the first page has been measured. */}
            <div
              ref={zoomOuterRef}
              className="pdf-zoom-outer relative m-auto shrink-0"
              style={pageNaturalSize ? { width: pageNaturalSize.w * zoom, height: pageNaturalSize.h * zoom } : undefined}
            >
              <div
                className="pdf-zoom-wrapper"
                style={{
                  width: pageNaturalSize?.w,
                  height: pageNaturalSize?.h,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              >
                <div
                  ref={pagesRenderTargetRef}
                  className="pdf-pages-target pointer-events-none select-none"
                />
              </div>
            </div>
          </div>

          {/* Zoom Controls - a sibling of the pane (not nested inside it), absolutely
              positioned against the modal panel. Living inside the pane meant every prior
              variant (fixed, sticky) got tangled up with the pane's own scroll/grid/transform
              context and kept breaking in one layout combination or another; the panel has
              no transform/filter of its own, so absolute positioning against it is
              unconditional and can't be affected by anything happening inside the pane.
              right offset clears the 320px (w-80) sidebar so this lands inside the pane's own
              right edge, not behind/inside the sidebar. */}
          <div className="absolute bottom-6 right-[21rem] z-[210] flex items-center h-8 bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-[8px] p-[3px]">
            <button
              onClick={() => applyZoomCentered(prev => prev - 0.1)}
              className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] cursor-pointer transition-all duration-150 ease-in-out"
              title="Zoom Out"
            >
              <span className="opacity-70 group-hover:opacity-100"><Minus className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
            </button>
            <button
              onClick={() => applyZoomCentered(() => DEFAULT_ZOOM)}
              className="px-2 h-[26px] flex items-center justify-center text-[11px] font-semibold text-[var(--bone-90)] hover:text-[var(--bone-100)] transition-all duration-150 ease-in-out min-w-[48px] text-center cursor-pointer"
              title={`Reset Zoom to ${Math.round(DEFAULT_ZOOM * 100)}%`}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => applyZoomCentered(prev => prev + 0.1)}
              className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] cursor-pointer transition-all duration-150 ease-in-out"
              title="Zoom In"
            >
              <span className="opacity-70 group-hover:opacity-100"><Plus className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
            </button>
          </div>

          {/* Sidebar Controls */}
          <div className="w-80 border-l border-[var(--bone-6)] flex flex-col bg-sidebar shrink-0">
            <div className="flex items-center justify-between p-5 border-b border-[var(--bone-6)]">
              <h2 className="text-lg font-semibold text-foreground">Export to PDF</h2>
              <button onClick={closeModal} className="p-1 rounded-full hover:bg-[var(--bone-6)] text-muted-foreground hover:text-foreground">
                <X strokeWidth={2} className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              <p className="text-sm text-muted-foreground">Export "{entityTitle}" to PDF with the settings below.</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-panel p-2.5 rounded-[var(--radius-small)] border border-[var(--bone-6)]">
                  <span className="text-[11px] font-ui-label text-[var(--bone-90)]">Include title</span>
                  <Toggle checked={includeTitle} onChange={setIncludeTitle} size="sm" />
                </div>

                <div className="flex items-center justify-between bg-panel p-2.5 rounded-[var(--radius-small)] border border-[var(--bone-6)]">
                  <span className="text-[11px] font-ui-label text-[var(--bone-90)]">Landscape</span>
                  <Toggle checked={landscape} onChange={setLandscape} size="sm" />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-ui-label text-[var(--bone-60)] block mb-1">Page Size</span>
                    <ExportSelect
                      value={pageSize}
                      onChange={v => setPageSize(v as any)}
                      options={[
                        { value: 'A4', label: 'A4' },
                        { value: 'square', label: 'Square' },
                        { value: 'presentation', label: 'Present' },
                      ]}
                    />
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] font-ui-label text-[var(--bone-60)] block mb-1">Layout</span>
                    <ExportSelect
                      value={layout}
                      onChange={v => setLayout(v as any)}
                      iconOnly
                      options={[
                        { value: 'vertical', label: 'Vertical', icon: <ArrowDown className="w-3.5 h-3.5" /> },
                        { value: 'horizontal', label: 'Horizontal', icon: <ArrowRight className="w-3.5 h-3.5" /> },
                      ]}
                    />
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] font-ui-label text-[var(--bone-60)] block mb-1">Theme</span>
                    <ExportSelect
                      value={theme}
                      onChange={v => setTheme(v as any)}
                      options={[
                        { value: 'light', label: 'Light' },
                        { value: 'dark', label: 'Dark' },
                      ]}
                    />
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] font-ui-label text-[var(--bone-60)] block mb-1">Font</span>
                    <ExportSelect
                      value={font}
                      onChange={v => setFont(v as any)}
                      options={[
                        { value: 'serif', label: 'Serif' },
                        { value: 'sans', label: 'Sans' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-[var(--bone-6)] flex items-center gap-2 shrink-0">
              <button
                onClick={closeModal}
                className="flex-1 h-7 rounded-[var(--radius-small)] text-[11px] font-semibold transition-none cursor-pointer flex items-center justify-center bg-[var(--bone-6)] hover:bg-[var(--app-dark)] text-[var(--bone-60)] hover:text-[var(--bone-100)]"
              >
                Cancel
              </button>
              <button
                onClick={handlePrint}
                disabled={isPaginating}
                className="flex-1 h-7 rounded-[var(--radius-small)] text-[11px] font-semibold transition-none cursor-pointer flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPaginating ? 'Preparing…' : 'Export PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function ExportSelect({
  value,
  onChange,
  options,
  iconOnly,
  align = 'left',
  popupWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  iconOnly?: boolean;
  align?: 'left' | 'right';
  popupWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  const width = popupWidth ?? posRef.current.width;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => {
          if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            posRef.current = { top: r.bottom + 4, left: r.left, width: r.width };
          }
          setOpen(prev => !prev);
        }}
        className={cn(
          "w-full h-7 rounded-[var(--radius-small)] text-[11px] border-none outline-none px-2 flex items-center justify-between gap-1 cursor-pointer transition-none",
          open
            ? "bg-[var(--bone-10)] text-[var(--bone-100)]"
            : "bg-[var(--bone-6)] text-[var(--bone-90)] hover:bg-[var(--app-dark)]"
        )}
      >
        {iconOnly ? (
          options.find(o => o.value === value)?.icon
        ) : (
          <span className="truncate">{options.find(o => o.value === value)?.label ?? value}</span>
        )}
        <ChevronDown className={cn("w-3 h-3 flex-shrink-0 text-[var(--bone-40)] transition-transform", open && "rotate-180")} />
      </button>
      {open && createPortal(
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: (() => {
              const popupHeight = options.length * 25 + 8;
              let t = posRef.current.top;
              if (t + popupHeight > window.innerHeight - 10) {
                t = Math.max(10, posRef.current.top - 28 - popupHeight - 8); // 28px is trigger h-7 height, 8px gap
              }
              return t;
            })(),
            left: align === 'right' ? posRef.current.left + posRef.current.width - width : posRef.current.left,
            width,
            zIndex: 9999
          }}
          className="bg-panel border border-[var(--bone-6)] rounded-[var(--radius-small)] shadow-2xl p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-2 h-6 flex items-center gap-2 rounded-[4px] text-[11px] transition-colors",
                value === opt.value
                  ? "bg-[var(--app-dark)] text-[var(--bone-100)] font-medium"
                  : "text-[var(--bone-90)] hover:bg-[var(--bone-5)] hover:text-[var(--bone-100)]"
              )}
            >
              {opt.icon && opt.icon}
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
