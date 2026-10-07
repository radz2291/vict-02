import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The example root, independent of the vitest working directory. */
const EXAMPLE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Product entry modules (the normal application consumer graph). */
const PRODUCT_ENTRIES = [
  'src/routes/+layout.svelte',
  'src/routes/+page.svelte',
  'src/routes/+page.server.ts',
  'src/routes/inspection/[id]/+page.svelte',
  'src/routes/inspection/[id]/+page.server.ts',
  'src/routes/api/inspection/[action]/+server.ts',
  'src/lib/server/inspection.ts',
  'src/lib/product/domain.ts',
];

const FORBIDDEN_IN_PRODUCT_GRAPH = ['ui-editor', 'ui-preview', 'EditorBridge', 'PreviewSession'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.svelte') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('U1-02: editor and scenario infrastructure stay out of the normal entry graph', () => {
  it('product entries never import editor/preview modules', () => {
    for (const entry of PRODUCT_ENTRIES) {
      const text = readFileSync(join(EXAMPLE_ROOT, entry), 'utf8');
      for (const forbidden of FORBIDDEN_IN_PRODUCT_GRAPH) {
        expect(text.includes(forbidden), `${entry} must not reference ${forbidden}`).toBe(false);
      }
    }
  });

  it('the studio route legitimately composes the editor and preview modules', () => {
    const studioFiles = walk(join(EXAMPLE_ROOT, 'src/routes/studio'));
    expect(studioFiles.length).toBeGreaterThan(0);
    const combined = studioFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(combined).toContain('ui-editor');
    expect(combined).toContain('ui-preview');
  });
});
