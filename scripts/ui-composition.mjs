import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const name of [
  'contracts',
  'ui',
  'sdk',
  'kernel',
  'runtime',
  'application',
  'ui-svelte',
  'renderer-svelte',
]) {
  const built = spawnSync(
    process.execPath,
    [process.env.npm_execpath, 'run', 'build', '-w', '@victframework/' + name],
    { cwd: root, stdio: 'inherit', windowsHide: true },
  );
  if (built.status !== 0) process.exit(built.status ?? 1);
}
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
    'dev',
    '--host',
    '127.0.0.1',
    '--port',
    '5179',
    '--strictPort',
  ],
  {
    cwd: fileURLToPath(new URL('../examples/ui-showcase/', import.meta.url)),
    env: { ...process.env, VICT_COMPOSITION: '1' },
    stdio: 'inherit',
    windowsHide: true,
  },
);
child.on('exit', (code) => process.exit(code ?? 0));
