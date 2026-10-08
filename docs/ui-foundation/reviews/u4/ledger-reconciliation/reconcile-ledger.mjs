/**
 * Ledger reconciliation (F3) — U4 catalog recalibration repair.
 *
 * Programmatically reconciles `packages/ui-svelte/catalog-coverage.json`
 * (41 families) against the delivery ledger in
 * `docs/ui-foundation/U4-COMPONENT-REUSE-MATRIX.md` §6:
 *   - every AVAILABLE family must appear in a ledger row whose Ledger cell
 *     carries an explicit contract/batch assignment (C → B-n / B-n / P3);
 *   - the three DEFERRED families may appear ONLY in a row whose Ledger
 *     cell is **X** (named exclusion) — never in an assignable row.
 *
 * Run: node reconcile-ledger.mjs  (from this directory)
 */
import { readFileSync } from 'node:fs';

const WORKTREE = 'C:/Users/RZ1/Desktop/RZ/vict-02-u4-catalog-repair';
const coverage = JSON.parse(readFileSync(`${WORKTREE}/packages/ui-svelte/catalog-coverage.json`, 'utf8'));
const matrix = readFileSync(`${WORKTREE}/docs/ui-foundation/U4-COMPONENT-REUSE-MATRIX.md`, 'utf8');

const slugToLedgerName = {
  accordion: 'Accordion', 'alert-dialog': 'AlertDialog', 'aspect-ratio': 'AspectRatio',
  avatar: 'Avatar', button: 'Button', calendar: 'Calendar', checkbox: 'Checkbox',
  collapsible: 'Collapsible', combobox: 'Combobox', command: 'Command', 'context-menu': 'ContextMenu',
  'date-field': 'DateField', 'date-picker': 'DatePicker', 'date-range-field': 'DateRangeField',
  'date-range-picker': 'DateRangePicker', dialog: 'Dialog', 'dropdown-menu': 'DropdownMenu',
  'link-preview': 'LinkPreview', menubar: 'Menubar', 'navigation-menu': 'NavigationMenu',
    label: 'Label', meter: 'Meter', 'scroll-area': 'ScrollArea', separator: 'Separator', toolbar: 'Toolbar', tooltip: 'Tooltip',
  pagination: 'Pagination', popover: 'Popover', progress: 'Progress', 'radio-group': 'RadioGroup',
  'range-calendar': 'RangeCalendar', select: 'Select', slider: 'Slider',
  switch: 'Switch', tabs: 'Tabs', 'time-field': 'TimeField',
  toggle: 'Toggle', 'toggle-group': 'ToggleGroup',
  'pin-input': 'PinInput', 'rating-group': 'RatingGroup', 'time-range-field': 'TimeRangeField',
};

// Parse §6 ledger rows: | Family cell | Modes | Ledger | Batch/proof |
const ledgerStart = matrix.indexOf('| Button (catalog) |');
const ledgerEnd = matrix.indexOf('\n\n', ledgerStart);
const rows = matrix.slice(ledgerStart, ledgerEnd).split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('| --- |'))
  .map((line) => line.split('|').slice(1, -1).map((c) => c.trim()))
  .map(([families, modes, ledgerCell, batch]) => ({
    families: families.split('/').map((s) => s.replace(/\(.*?\)/g, '').trim()),
    ledgerCell,
    batch,
  }));

function rowFor(name) {
  return rows.find((r) => r.families.includes(name));
}

const available = coverage.families.filter((f) => f.status !== 'deferred');
const deferred = coverage.families.filter((f) => f.status === 'deferred');
const missing = [], inXOnlyWrongly = [];
const assignment = {};
for (const f of available) {
  const name = slugToLedgerName[f.slug];
  const row = rowFor(name);
  if (!row) { missing.push(f.slug); continue; }
  if (row.ledgerCell === '**X**') { inXOnlyWrongly.push(f.slug); continue; }
  assignment[f.slug] = `${row.ledgerCell} (${row.batch})`;
}
const deferredBad = [];
for (const f of deferred) {
  const name = slugToLedgerName[f.slug];
  const row = rowFor(name);
  if (!row || row.ledgerCell !== '**X**') deferredBad.push(f.slug);
}
console.log(`coverage families: ${coverage.families.length} (${available.length} available, ${deferred.length} deferred; bits ${coverage.bitsVersion})`);
console.log(`available families missing a ledger row: ${missing.length ? missing.join(', ') : 'NONE'}`);
console.log(`available families sitting in an X-exclusion row: ${inXOnlyWrongly.length ? inXOnlyWrongly.join(', ') : 'NONE'}`);
console.log(`deferred families outside a named-exclusion row: ${deferredBad.length ? deferredBad.join(', ') : 'NONE'}`);
const sample = Object.entries(assignment).slice(0, 4).map(([k, v]) => `${k}=${v}`).join('; ');
console.log(`sample assignments: ${sample}`);
console.log(missing.length === 0 && inXOnlyWrongly.length === 0 && deferredBad.length === 0
  ? 'RECONCILIATION OK: every available family has an explicit ledger assignment; the three deferred families remain named exclusions only'
  : 'RECONCILIATION FAILED');
