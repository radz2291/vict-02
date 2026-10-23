/** Optional explicit reuse of the existing local Ollama auth-file boundary.
 * No key is printed, passed as a CLI argument, or written to disk. */
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The app applies a stricter aggregate UTF-8 bound and returns structured errors.
// Keep adapter-node's preliminary body cap above that contract (including JPEG upload).
process.env.BODY_SIZE_LIMIT ??= '2M';
const provider = process.env.STUDIO_AGENT_MODEL?.split('/')[0] ?? 'zai';
const credentialName = provider === 'zai' ? 'ZAI_API_KEY' : 'OLLAMA_API_KEY';
const authProvider = provider === 'zai' ? 'zai' : 'ollama';
if (!process.env[credentialName] && process.env.STUDIO_AGENT_AUTH_FILE) {
  try {
    const auth = JSON.parse(readFileSync(process.env.STUDIO_AGENT_AUTH_FILE, 'utf8'));
    const key = auth[authProvider]?.key;
    if (typeof key !== 'string' || !key.trim()) throw new Error();
    process.env[credentialName] = key;
  } catch {
    process.stderr.write(
      'STUDIO_AGENT_CREDENTIAL_UNAVAILABLE: the configured auth file could not supply the selected provider key.\n',
    );
    process.exit(1);
  }
}
if (provider === 'zai' && process.env.STUDIO_AGENT_MODELS_FILE) {
  try {
    const models = JSON.parse(readFileSync(process.env.STUDIO_AGENT_MODELS_FILE, 'utf8'));
    const entry = models.providers?.[process.env.STUDIO_AGENT_PROVIDER_ENTRY || 'zai-key1'];
    const endpoint = new URL(entry.baseUrl);
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      throw new Error();
    process.env.STUDIO_AGENT_BASE_URL = endpoint.href.replace(/\/$/, '');
  } catch {
    process.stderr.write('STUDIO_AGENT_MODEL_CONFIGURATION_UNAVAILABLE\n');
    process.exit(1);
  }
}
if (!process.env.STUDIO_AGENT_MODEL && process.env.ZAI_API_KEY) {
  process.env.STUDIO_AGENT_MODEL = 'zai/glm-5.3-flash';
}
const child = spawn(process.execPath, ['build'], {
  cwd: studioRoot,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', () => {
  process.stderr.write('STUDIO_AGENT_LAUNCH_FAILED\n');
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
