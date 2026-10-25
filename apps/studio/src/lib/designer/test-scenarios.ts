import type { UiDocument, UiNode, UiValue, UiExpression } from '@victframework/ui';
import { structureChildren } from './structure.js';
import { screenActionState } from './application.js';
import { studioNodeLabels } from './presentation.js';

export type TestScenario = {
  id: string; label: string; description: string;
  values?: Readonly<Record<string, UiValue>>;
  simulation?: 'denied' | 'failNext';
};

/** Presentation projection of declared behavior, never a variable-name heuristic. */
export function testScenarios(document: UiDocument): TestScenario[] {
  const reachable: UiNode[] = [], seen = new Set<string>();
  const disabled = (value: unknown): boolean => {
    if(value===undefined)return false;
    if(!value || typeof value!=='object')return true;
    const expression=value as UiExpression;
    if(expression.type==='literal')return expression.value!==false;
    if(expression.type==='ref' && expression.path.startsWith('state.')) {
      const state=document.localState[expression.path.slice(6)];return state?.type!=='boolean' || state.initial!==false;
    }
    return true;
  };
  function visit(id: string) {
    if (seen.has(id)) return;
    seen.add(id);
    const node = document.nodes[id];
    if (!node) return;
    // Eligibility is conservative: source templates/conditional branches require
    // runtime scopes, and must not be mistaken for currently rendered controls.
    if (['conditional','repeat','slot'].includes(node.kind)) return;
    if (node.kind === 'component' && document.componentDefinitions[node.definitionId]) return;
    if (node.kind==='element' && node.attributes?.hidden !== undefined) {
      const hidden=node.attributes.hidden;
      if(typeof hidden==='string' || hidden.type!=='literal' || hidden.value!==false)return;
    }
    if(node.kind==='element' && node.tag==='fieldset' && disabled(node.attributes?.disabled))return;
    const styles=[...(node.localStyle??[]),...(node.styleSources??[]).flatMap(id=>document.styleSources[id]?.declarations??[])];
    if(styles.some(style=>style.value.type==='text' && ((style.property==='display' && style.value.value==='none') || (style.property==='visibility' && ['hidden','collapse'].includes(style.value.value)))) )return;
    reachable.push(node);
    if(node.kind!=='component')structureChildren(node).forEach(child => visit(child.id));
  }
  visit(document.root);
  function validSubmit(input:Readonly<Record<string,UiExpression>>|undefined) {
    if(!input || Object.keys(input).length!==2)return false;
    return (['message','accepted'] as const).every(key=>{
      const expression=input[key],type=key==='message'?'string':'boolean';
      return expression?.type==='literal' ? typeof expression.value===type : expression?.type==='ref' && expression.path.startsWith('state.') && document.localState[expression.path.slice(6)]?.type===type;
    });
  }
  const hasSubmit = reachable.filter(node => (node.kind==='element' && !disabled(node.attributes?.disabled)) || (node.kind==='component' && node.definitionId==='vict.catalog.button' && !disabled(node.props?.disabled))).some(node =>
    node.interactions?.some(binding => binding.action === 'invokeAction' && binding.actionId === 'demo.submit' && validSubmit(binding.input)) ||
    (node.kind === 'component' && Object.values(node.outputs ?? {}).some(binding => 'invokeAction' in binding && binding.invokeAction.actionId === 'demo.submit' && validSubmit(binding.invokeAction.input))));
  const reads = (value: unknown, key: string): boolean => {
    if (!value || typeof value !== 'object') return false;
    const object = value as Record<string, unknown>;
    if (object.type === 'ref' && object.path === `state.${key}`) return true;
    return Object.values(object).some(child => reads(child, key));
  };
  // Only rendered values/props/style/conditions count, not action inputs or writes.
  const displayed = (key: string) => reachable.some(node => reads(
    node.kind === 'element' ? node.attributes?.disabled : node.kind === 'text' ? node.content : undefined, key)) ||
    reachable.some(node => reads(node.localStyle, key) || node.styleSources?.some(id => reads(document.styleSources[id]?.declarations,key)));
  const scenarios: TestScenario[] = [];
  if (hasSubmit) {
    const pending = screenActionState['demo.submit'].pending;
    if (document.localState[pending]?.type === 'boolean' && displayed(pending)) scenarios.push({
      id: 'loading', label: 'Loading', description: 'Show the controls connected to this screen’s loading state. No request is started.', values: { [pending]: true },
    });
    const errorNote = displayed(screenActionState['demo.submit'].error) ? ' Try the screen’s submit button to see its response.' : ' This view has no directly connected error message; check Recent activity after submitting.';
    scenarios.push(
      { id: 'failure', label: 'Something went wrong', description: 'The next submit action will fail.'+errorNote, simulation: 'failNext' },
      { id: 'denied', label: 'Permission denied', description: 'Submit actions will be refused until you reset the test.'+errorNote, simulation: 'denied' },
    );
  }
  const names=studioNodeLabels(document);
  for (const node of reachable) {
    if (node.kind !== 'component' || !['vict.catalog.dialog', 'vict.catalog.popover', 'vict.catalog.alert-dialog'].includes(node.definitionId)) continue;
    const open = node.props?.open;
    if (open?.type !== 'ref' || !open.path.startsWith('state.')) continue;
    const key = open.path.slice(6);
    if (document.localState[key]?.type !== 'boolean') continue;
    const label = node.definitionId === 'vict.catalog.popover' ? 'Popover' : 'Dialog';
    scenarios.push({ id: `open:${node.id}`, label: `Open ${names[node.id] ?? label}`, description: `Show ${names[node.id] ?? label} using its connected open/closed value.`, values: { [key]: true } });
  }
  const textKeys = new Set<string>();
  for (const node of reachable) {
    // Use actual editable plain-text fields; never seed password/email/hidden fields.
    if (node.kind !== 'element' || !(node.tag === 'textarea' || (node.tag === 'input' && [undefined, 'text', 'search'].includes(node.attributes?.type as string | undefined)))) continue;
    const value = node.attributes?.value;
    if (!value || typeof value !== 'object' || value.type !== 'ref' || !value.path.startsWith('state.')) continue;
    const key = value.path.slice(6);
    if (document.localState[key]?.type === 'string') textKeys.add(key);
  }
  if (textKeys.size) {
    for (const [id, label, sample] of [['empty', 'Empty content', ''], ['typical', 'Typical content', 'Sample text'], ['long', 'Long content', 'A longer example that helps you check wrapping, spacing and how comfortably your screen handles more content. '.repeat(3)]] as const) {
      const values = Object.fromEntries([...textKeys].map(key => [key, id === 'typical' && document.localState[key]!.initial ? document.localState[key]!.initial : sample]));
      scenarios.push({ id: `content:${id}`, label, description: 'Fill connected plain-text fields with temporary sample content. Other fields stay unchanged.', values });
    }
  }
  return scenarios;
}
