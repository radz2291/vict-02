import {describe, it, expect} from 'vitest';
import {mount, unmount, flushSync} from 'svelte';
import PublicPattern from '../src/authoring/PublicPattern.svelte';
import {publicPatternDescriptors, publicPatternRegistrations, publicPatternImplementations, publicPatternCompatibility} from '../src/authoring/public-patterns.js';
import {publicPatternKinds, publicPatternSeedData, parsePublicPatternData, validatePublicPatternScalars} from '../src/authoring/passive-data.js';
import {createUiAuthoringRegistry} from '@victframework/ui';

describe('public AI authoring patterns', () => {
  it('registers all fourteen public activity patterns and standalone safe Markdown with sealed exact contracts', () => {
    const registry = createUiAuthoringRegistry([{schema: 'vict.ui-authoring@1', packageName: '@victframework/ui-ai-svelte', packageVersion: '0.4.0-rc.1', registrations: publicPatternRegistrations, compatibility: publicPatternCompatibility, exportDispositions: []}], publicPatternImplementations, {requireCompatibility: true});
    expect(registry.issues).toEqual([]);
    expect(registry.contracts).toHaveLength(15);
    expect(new Set(registry.contracts.map(contract => contract.descriptor.id)).size).toBe(15);
  });
  it.each(publicPatternKinds)('renders %s through its existing public pattern, with no fabricated run records', async kind => {
    const target = document.createElement('div'); document.body.append(target);
    const descriptor = publicPatternDescriptors.find(item => item.id === `vict.ai.${kind}`)!;
    const props = Object.fromEntries(descriptor.props.filter(prop => prop.default !== undefined).map(prop => [prop.name, prop.default]));
    const component = mount(PublicPattern, {target, props: {kind, props, occurrenceKey: 'case', nodeId: 'case'}});
    flushSync();
    expect(target.querySelector('[role="alert"]')).toBeNull();
    expect(target.querySelector('.vict-ai')).not.toBeNull();
    await unmount(component); target.remove();
  });
  it('shows invalid structured input as an error instead of pretending tool output exists', async () => {
    const target = document.createElement('div'); document.body.append(target);
    const component = mount(PublicPattern, {target, props: {kind: 'tool', props: {data: '{"version":1,"execute":true}', title: 'Visible tool'}, occurrenceKey: 'case', nodeId: 'case'}});
    flushSync(); expect(target.querySelector('[role="alert"]')?.textContent).toContain('unknown field');
    expect(target.textContent).not.toContain('Visible tool');
    await unmount(component); target.remove();
  });
  it('keeps supplied unsafe citation URLs inert and sanitizes Markdown HTML', async () => {
    for (const [kind, props] of [
      ['sources', {data: JSON.stringify({version: 1, sources: [{id: 'x', title: 'Unsafe', url: 'javascript:alert(1)'}]}), open: true}],
      ['markdown', {data: '{"version":1}', text: '<script>alert(1)</script> [Unsafe](javascript:alert(1)) ![remote](https://example.com/a.png)'}],
    ] as const) {
      const target = document.createElement('div'); document.body.append(target);
      const component = mount(PublicPattern, {target, props: {kind, props, occurrenceKey: 'case', nodeId: 'case'}});
      flushSync(); await new Promise(resolve => setTimeout(resolve, 20)); flushSync();
      expect(target.querySelector('a[href^="javascript:"],script,img')).toBeNull();
      await unmount(component); target.remove();
    }
  });
  it('emits supplied file selection only when explicitly enabled; never reads files', async () => {
    const events: unknown[] = [], target = document.createElement('div'); document.body.append(target);
    const data = JSON.stringify({version: 1, nodes: [{path: 'project/file.txt', name: 'file.txt'}]});
    const component = mount(PublicPattern, {target, props: {kind: 'file-tree', props: {data, allowSelect: true}, occurrenceKey: 'case', nodeId: 'case', io: {emit: (name, value) => events.push([name, value])}}});
    flushSync(); (target.querySelector('button') as HTMLButtonElement).click();
    expect(events).toEqual([['select', 'project/file.txt']]);
    await unmount(component); target.remove();
  });
  it('forwards declared part classes and bindings to actual public trace, field and link surfaces', async () => {
    const step = {id: 's', title: 'Public step', status: 'done', detail: 'Observed detail', code: 'const publicValue = 1;', badges: ['Supplied'], links: [{title: 'Reference', url: 'https://example.com/'}]};
    const cases = [
      ['reasoning', {text: 'Supplied public summary', duration: 1, open: true}, ['row', 'title', 'icon', 'metadata', 'disclosure', 'body']],
      ['chain-of-thought', {data: JSON.stringify({version: 1, steps: [step]}), open: true}, ['row', 'title', 'icon', 'disclosure', 'body', 'code', 'badge', 'link']],
      ['tool', {state: 'completed', output: 'Supplied result', input: '{}', details: true, open: true}, ['row', 'title', 'icon', 'disclosure', 'body', 'code']],
      ['tool', {state: 'completed', output: 'Supplied result', allowOpenOutput: true}, ['output-action']],
      ['tool', {allowDecision: true, approvalTitle: 'Supplied decision', approvalDescription: 'Host-owned decision request'}, ['title', 'description', 'actions', 'approve', 'deny']],
      ['plan', {data: JSON.stringify({version: 1, steps: [step]}), open: true}, ['row', 'title', 'icon', 'metadata', 'disclosure', 'body']],
      ['task', {data: JSON.stringify({version: 1, steps: [step]}), open: true}, ['row', 'title', 'icon', 'disclosure', 'body']],
      ['queue', {data: JSON.stringify({version: 1, steps: [step]}), completedOpen: true}, ['row', 'title', 'icon', 'disclosure', 'body']],
      ['terminal', {command: 'supplied-command', output: 'Supplied output', open: true}, ['row', 'title', 'icon', 'disclosure', 'body', 'code']],
      ['test-results', {data: JSON.stringify({version: 1, testSuites: [{id: 'suite', name: 'Supplied suite', tests: [{id: 'test', name: 'Supplied test', status: 'failed', error: 'Supplied failure'}]}]}), open: true, errorsOpen: true}, ['row', 'title', 'icon', 'disclosure', 'body', 'code']],
      ['stack-trace', {frames: 'Supplied error\nat main (src/main.ts:1:2)', open: true, allowSelect: true}, ['row', 'title', 'icon', 'disclosure', 'body', 'error', 'frame-action']],
      ['subagent', {data: JSON.stringify({version: 1, steps: [step], tools: ['Supplied tool']}), duration: 1, model: 'Supplied model', result: 'Supplied result', open: true}, ['row', 'title', 'icon', 'metadata', 'disclosure', 'body', 'code', 'badge', 'result']],
      ['sources', {data: JSON.stringify({version: 1, sources: [{id: 'c', title: 'Supplied source', url: 'https://example.com/'}]}), open: true}, ['row', 'title', 'icon', 'disclosure', 'body', 'source']],
      ['file-tree', {data: JSON.stringify({version: 1, nodes: [{path: 'root', name: 'Supplied folder', children: [{path: 'root/file', name: 'Supplied file'}]}]})}, ['folder', 'file', 'folder-body']],
    ] as const;
    for (const [kind, values, parts] of cases) {
      const target = document.createElement('div'); document.body.append(target);
      const props = {data: JSON.stringify(publicPatternSeedData[kind]), ...values};
      const component = mount(PublicPattern, {target, props: {kind, props, occurrenceKey: 'parts', nodeId: 'parts', presentation: {target: name => ({'data-ui-part': name, class: `author-${name}`, style: '--authored-binding: 9px'})}}});
      flushSync();
      for (const disclosure of target.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]')) disclosure.click();
      flushSync();
      for (const part of parts) {
        const actual = target.querySelector<HTMLElement>(`[data-ui-part="${part}"]`);
        expect(actual, `${kind}/${part} actual surface`).not.toBeNull();
        expect(actual?.style.getPropertyValue('--authored-binding'), `${kind}/${part} binding`).toBe('9px');
        expect(target.querySelector(`.author-${part}`), `${kind}/${part} class`).not.toBeNull();
      }
      await unmount(component); target.remove();
    }
  });
});

describe('bounded public activity schemas', () => {
  it.each(publicPatternKinds)('accepts the canonical empty seed for %s', kind => {
    expect(parsePublicPatternData(kind, JSON.stringify(publicPatternSeedData[kind])).ok).toBe(true);
  });
  it('rejects malformed, mismatched, versionless and oversized data', () => {
    for (const data of ['', '{}', '{"version":2}', '{"version":1,"steps":"wrong"}', '{"version":1,"steps":[],"privateReasoning":true}', ' '.repeat(131073)]) expect(parsePublicPatternData('plan', data).ok).toBe(false);
    expect(parsePublicPatternData('test-results', JSON.stringify({version: 1, testSuites: [{id: 'suite', name: 'Suite', tests: [{id: 'test', name: 'Pending', status: 'pending'}]}]})).ok).toBe(false);
  });
  it('rejects duplicate identities, unbounded trees, conflicting global paths and nonfinite numeric data', () => {
    expect(parsePublicPatternData('sources', JSON.stringify({version: 1, sources: [{id: 'a', title: '', url: ''}, {id: 'a', title: '', url: ''}]})).ok).toBe(false);
    let nodes: unknown[] = [];
    for (let depth = 0; depth < 15; depth++) nodes = [{path: `p${depth}`, name: 'nested', children: nodes}];
    expect(parsePublicPatternData('file-tree', JSON.stringify({version: 1, nodes})).ok).toBe(false);
    expect(parsePublicPatternData('file-tree', JSON.stringify({version: 1, nodes: [{path: 'same', name: 'Parent', children: [{path: 'same', name: 'Child'}]}]})).ok).toBe(false);
    expect(parsePublicPatternData('context', '{"version":1,"breakdown":[{"label":"tokens","value":1e999}]}').ok).toBe(false);
  });
  it('rejects unknown run phases and impossible metadata rather than implying completion', () => {
    expect(validatePublicPatternScalars('tool', {state: 'invented-success'})).toContain('state');
    expect(validatePublicPatternScalars('subagent', {state: 'denied'})).toContain('state');
    expect(validatePublicPatternScalars('terminal', {status: 'succeeded', exitCode: 0})).toContain('status');
    expect(validatePublicPatternScalars('reasoning', {duration: -1})).toContain('duration');
    expect(validatePublicPatternScalars('terminal', {exitCode: 0.5})).toContain('exitCode');
    expect(validatePublicPatternScalars('context', {used: Infinity})).toContain('used');
    expect(validatePublicPatternScalars('tool', {state: 'completed'})).toBeUndefined();
  });
});
