import { mount } from 'svelte';
import '@victframework/ui-svelte/styles.css';
import '@victframework/ui-svelte/catalog.css';
import '../../src/lib/designer/workspace.css';
import '../../src/lib/designer/designer.css';
import Fixture from './Fixture.svelte';

// Deliberate layout fixture, outside SvelteKit routes. This is not agent proof.
const realFetch = globalThis.fetch;
const scenario = new URL(location.href).searchParams.get('scenario');
globalThis.fetch = async (input, init) => {
  if (!String(input).startsWith('/api/designer-agent')) return realFetch(input, init);
  if (init?.method !== 'POST')
    return Response.json({
      csrf: 'fixture',
      ready: scenario !== 'offline',
      model: 'zai/glm-5.3-flash',
    });
  const steps = [
    'Read the current screen and component contracts',
    'Prepare the registration form container',
    'Add name and email fields',
    'Add password and confirmation fields',
    'Align the fields and registration action',
    'Check the selected field label and validation',
    'Apply the requested field change',
    'Validate the final registration layout and spacing',
  ];
  const events: unknown[] = [
    { type: 'started', runId: 'layout-fixture', model: 'zai/glm-5.3-flash', engine: 'fixture' },
    {
      type: 'text',
      delta:
        '### Registration form\n\nI added a **registration form** using the existing components.\n\n- **Name** and **Email** fields\n- Password and confirmation\n- A registration action\n\n',
    },
  ];
  for (const [index, reason] of steps.entries()) {
    events.push({ type: 'progress', message: reason });
    events.push({ type: 'edit-result', reason, result: { ok: true } });
    events.push({
      type: 'text',
      delta: `**Step ${index + 1}.** ${reason}. The existing screen structure and editing history are preserved. Select a field on the canvas to request a targeted change.\n`,
    });
  }
  events.push({
    type: 'text',
    delta: '\nYou can undo these changes or save the screen when you are ready.',
  });
  events.push({
    type: 'done',
    status: scenario === 'failure' ? 'failed' : 'completed',
    code: scenario === 'failure' ? 'STUDIO_AGENT_PROVIDER_FAILED' : undefined,
    applied: 3,
    turnId: 'layout-fixture',
    profileVersion: 'fixture',
  });
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        controller.close();
      },
    }),
    { headers: { 'content-type': 'application/x-ndjson' } },
  );
};
mount(Fixture, { target: document.getElementById('app')! });
