import { runAraTurn } from './ara.js';
import { AssistantMessageContract } from './contracts.js';

/**
 * Executable demonstration: one deterministic ARA turn, printed with its run
 * identity and ordered event summary. Runs fully offline.
 *
 *   npm run example [optional user text]
 */
async function main(): Promise<void> {
  const text = process.argv[2] ?? 'Help me make this practical';

  const { result, graphVersion } = await runAraTurn(text);

  if (result.status !== 'completed' || !result.output) {
    console.error(`ARA run did not complete: status=${result.status}`, result.error);
    process.exit(1);
  }

  const validated = AssistantMessageContract.parse(result.output);
  if (!validated.ok) {
    console.error('Final output failed its contract:', validated.issues);
    process.exit(1);
  }

  console.log('=== ARA proof ===');
  console.log('Final structured response:');
  console.log(JSON.stringify(validated.value, null, 2));
  console.log(`Run ID: ${result.runId}`);
  console.log(`Graph version: ${graphVersion}`);
  console.log('Ordered events:');
  for (const event of result.trace) {
    const node = 'nodeId' in event ? ` ${event.nodeId}` : '';
    console.log(`  ${String(event.seq).padStart(2, '0')}. ${event.type}${node}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
