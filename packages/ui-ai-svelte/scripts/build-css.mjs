import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
const rawPath = path.join(out, 'styles.generated.css');
const cli = fileURLToPath(
  new URL('./dist/index.mjs', import.meta.resolve('@tailwindcss/cli/package.json')),
);
execFileSync(
  process.execPath,
  [cli, '-i', path.join(root, 'src/styles.input.css'), '-o', rawPath],
  { cwd: root, stdio: 'inherit' },
);
const css = postcss.parse(fs.readFileSync(rawPath, 'utf8'));
// Unlayer the package styles so host unlayered type selectors cannot override
// the upstream presentation merely because Tailwind uses layers internally.
css.walkAtRules('layer', (rule) => {
  if (rule.nodes) rule.replaceWith(...rule.nodes);
  else rule.remove();
});
css.walkRules((rule) => {
  let parent = rule.parent;
  while (parent) {
    if (parent.type === 'rule' || (parent.type === 'atrule' && /keyframes$/.test(parent.name)))
      return;
    parent = parent.parent;
  }
  rule.selectors = rule.selectors.map((selector) => {
    if (selector === ':root' || selector === ':host') return '.vict-ai';
    return `.vict-ai.vict-ai ${selector}`;
  });
});
// Give internal utility properties and keyframes package-owned identities.
let compiled = css.toString().replaceAll('--tw-', '--vict-ai-tw-');
const animationNames = new Map();
css.walkAtRules(/keyframes$/, (rule) => animationNames.set(rule.params, `vict-ai-${rule.params}`));
for (const [from, to] of animationNames)
  compiled = compiled.replace(
    new RegExp(`(?<![\\w-])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'g'),
    to,
  );
const base = `/* VICT-owned scope for pinned shadcn-svelte Rhea; no global preflight. */
.vict-ai {
  --radius: .625rem;
  --background: var(--vict-ai-background, #fff); --foreground: var(--vict-ai-foreground, #20232b);
  --card: var(--background); --card-foreground: var(--foreground);
  --popover: var(--background); --popover-foreground: var(--foreground);
  --primary: var(--vict-ai-primary, #3046a5); --primary-foreground: #fff;
  --secondary: #f1f3f7; --secondary-foreground: #252a39;
  --muted: #f1f3f7; --muted-foreground: #596276;
  --accent: #edf0fa; --accent-foreground: #25356d;
  --destructive: #ad243c; --border: #dbe0e8; --input: #e4e8f0; --ring: #7689cf;
  color:var(--foreground); font-family:var(--vict-ai-font,system-ui,sans-serif); font-size:14px; line-height:1.5;
}
.vict-ai.vict-ai *, .vict-ai.vict-ai *::before, .vict-ai.vict-ai *::after {box-sizing:border-box;border:0 solid var(--border);}
.vict-ai.vict-ai :where(button,input,textarea,select) {font:inherit;color:inherit;letter-spacing:inherit;border-radius:0;background:transparent;box-shadow:none;}
.vict-ai.vict-ai :where(button) {cursor:pointer;}
.vict-ai.vict-ai :where(button:disabled) {cursor:default;}
.vict-ai.vict-ai :where(p,h1,h2,h3,h4,h5,h6,pre,blockquote,figure,ul,ol) {margin:0;}
.vict-ai.vict-ai :where(h1,h2,h3,h4,h5,h6) {font-size:inherit;font-weight:inherit;}
.vict-ai.vict-ai :where(svg) {display:block;vertical-align:middle;}
.vict-ai.vict-ai :where(a) {color:inherit;text-decoration:inherit;}
.vict-ai.vict-ai :where(textarea) {resize:vertical;}
.vict-ai.vict-ai :where([hidden]:not([hidden=until-found])) {display:none!important;}
`;
fs.writeFileSync(path.join(out, 'styles.css'), base + compiled + '\n');
fs.unlinkSync(rawPath);
console.log('Built isolated ui-ai-svelte/dist/styles.css');
