/** Non-destructive capability probe. Never log/persist provider text or credentials. */
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
const report = { model: 'zai/glm-5.3-flash', observedAt: new Date().toISOString(), isolatedRequest: true, prompt: 'Reply exactly READY.', maxOutputTokens: 512, outcome: 'unavailable', partCounts: {}, reasoningCharacters: 0, publicTextCharacters: 0, retainedContent: false, thinkingOverride: false };
try {
  const auth = JSON.parse(await readFile(join(homedir(), '.pi/agent/auth.json'), 'utf8'));
  const models = JSON.parse(await readFile(join(homedir(), '.pi/agent/models.json'), 'utf8'));
  const endpoint = new URL(models.providers['zai-key1'].baseUrl);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || typeof auth.zai?.key !== 'string') throw new Error();
  const model = new ModelRouterLanguageModel({ id: report.model, url: endpoint.href.replace(/\/$/, ''), apiKey: auth.zai.key });
  const signal = AbortSignal.timeout(60_000);
  const response = await model.doStream({ prompt: [{ role: 'user', content: [{ type: 'text', text: report.prompt }] }], maxOutputTokens: report.maxOutputTokens, abortSignal: signal });
  const reader = response.stream.getReader();
  report.outcome = 'stream-ended-without-finish';
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const part = next.value;
      const type = /^[a-z-]{1,40}$/.test(part.type) ? part.type : 'unknown';
      report.partCounts[type] = (report.partCounts[type] ?? 0) + 1;
      const count = typeof part.delta === 'string' ? part.delta.length : typeof part.textDelta === 'string' ? part.textDelta.length : 0;
      if (type === 'reasoning-delta') report.reasoningCharacters += count;
      if (type === 'text-delta') report.publicTextCharacters += count;
      if (type === 'error') report.outcome = 'provider-error';
      if (type === 'finish' && report.outcome !== 'provider-error') report.outcome = 'finished';
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
} catch { report.outcome = 'unavailable-or-failed'; }
await writeFile(new URL('./provider-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report) + '\n');
