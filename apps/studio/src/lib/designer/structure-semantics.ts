import type {
  UiDocument,
  UiExpression,
  UiNode,
  UiRenderPlan,
  UiExtensionDescriptor,
  UiSlotScope,
} from '@victframework/ui';
import type { UiActionStateConnection } from '@victframework/ui-svelte';
import { conditionDescription, branchDescription } from './structure-behavior.js';

/** Read-only presentation context. Execution and validation remain framework-owned. */
export type StructureContext = {
  descriptors?: readonly UiExtensionDescriptor[];
  actionState?: Readonly<Record<string, UiActionStateConnection>>;
  actionIds?: readonly string[];
  routeIds?: readonly string[];
  plan?: UiRenderPlan;
};
export type RelationRole =
  | 'contains'
  | 'value'
  | 'updates'
  | 'payload'
  | 'fallback'
  | 'items'
  | 'key'
  | 'condition'
  | 'branch'
  | 'otherwise'
  | 'template'
  | 'uses'
  | 'defines'
  | 'slot'
  | 'invokes'
  | 'navigates'
  | 'styles'
  | 'pending'
  | 'error'
  | 'result'
  | 'success'
  | 'overlay'
  | 'emits';
export const relationLabels: Record<RelationRole, string> = {
  contains: 'Contains',
  value: 'Value',
  updates: 'Updates',
  payload: 'Payload',
  fallback: 'Fallback',
  items: 'Items',
  key: 'Key',
  condition: 'Condition',
  branch: 'Branch',
  otherwise: 'Otherwise',
  template: 'Template',
  uses: 'Uses',
  defines: 'Defines',
  slot: 'Slot',
  invokes: 'Invokes',
  navigates: 'Navigates',
  styles: 'Styles',
  pending: 'Pending',
  error: 'Error',
  result: 'Result',
  success: 'Success',
  overlay: 'Overlay',
  emits: 'Emits',
};
export type RelationSpec = {
  role: RelationRole;
  path: string;
  owner: string;
  description?: string;
  origin?: 'document' | 'host';
};
export type SemanticNode = {
  scope?: string;
  registryId?: string;
  sourcePath?: string;
  summary?: string;
  kindLabel?: string;
  support?: 'External' | 'Unsupported' | 'Unknown';
  issues?: string[];
};
type Builder = {
  add: (kind: string, id: string, label: string, data?: SemanticNode) => string;
  node: (id: string) => string;
  link: (from: string, to: string, spec: RelationSpec) => void;
};
type Scope = {
  slot?:{owner:string;name:string;contract:UiSlotScope};
  definition?: string;
  repeats: readonly { id: string; name: string }[];
  output?: { node: string; name: string };
};
const unreachable = (value: never): never => {
  throw new Error(`Unmapped Structure vocabulary: ${JSON.stringify(value)}`);
};
const segment = (value: string) => value.replaceAll('~', '~0').replaceAll('/', '~1');
const display = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.]/g, ' ')
    .replace(/^./, (v) => v.toUpperCase());

/** Exhaustive typed visitors: opaque attributes/metadata never grant graph behaviour. */
export function projectRelations(
  document: UiDocument,
  b: Builder,
  context: StructureContext = {},
): void {
  const scopes = new Map<string, Map<string, Scope>>();
  const scopeKey = (scope: Scope) =>
    JSON.stringify([scope.definition ?? 'document', scope.repeats, scope.output,scope.slot?.owner,scope.slot?.name]);
  function visit(id: string, scope: Scope, ancestors = new Set<string>()) {
    const node = document.nodes[id];
    if (!node || ancestors.has(id)) return;
    const contexts = scopes.get(id) ?? new Map<string, Scope>();
    if (contexts.has(scopeKey(scope))) return;
    contexts.set(scopeKey(scope), scope);
    scopes.set(id, contexts);
    const next = new Set(ancestors).add(id);
    switch (node.kind) {
      case 'element':
      case 'portal':
        node.children.forEach((child) => visit(child, scope, next));
        break;
      case 'component':
        Object.entries(node.slots ?? {}).forEach(([name,fill]) =>
          fill.children.forEach((child) => visit(child, fill.scope?{...scope,definition:undefined,slot:{owner:node.id,name,contract:fill.scope}}:scope, next)),
        );
        break;
      case 'repeat':
        visit(
          node.templateRoot,
          { ...scope, repeats: [...scope.repeats, { id: node.id, name: node.itemName }] },
          next,
        );
        break;
      case 'conditional':
        node.branches.forEach((branch) =>
          branch.children.forEach((child) => visit(child, scope, next)),
        );
        break;
      case 'slot':
        node.fallback?.forEach((child) => visit(child, scope, next));
        break;
      case 'text':
        break;
      default:
        unreachable(node);
    }
  }
  visit(document.root, { repeats: [] });
  for (const def of Object.values(document.componentDefinitions)) {
    const scope = { definition: def.id, repeats: [] };
    visit(def.root, scope);
    Object.values(def.slots).forEach((slot) => slot.fallback?.forEach((id) => visit(id, scope)));
  }
  const registry = (kind: 'state' | 'style' | 'token' | 'condition' | 'asset', id: string) =>
    b.add(kind, id, display(id), {
      kindLabel: display(kind),
      ...(kind === 'condition' && document.conditions[id]
        ? { summary: conditionDescription(document, id) }
        : {}),
      ...(kind === 'token' && document.tokens[id] ? { summary: document.tokens[id].value } : {}),
      sourcePath: `/${{ state: 'localState', style: 'styleSources', token: 'tokens', condition: 'conditions', asset: 'assets' }[kind]}/${segment(id)}`,
      ...((kind === 'state' && !document.localState[id]) ||
      (kind === 'asset' && !document.assets[id]) ||
      (kind === 'style' && !document.styleSources[id]) ||
      (kind === 'token' && !document.tokens[id]) ||
      (kind === 'condition' && !document.conditions[id])
        ? { support: 'Unknown' as const }
        : {}),
    });
  for (const id of Object.keys(document.styleSources)) registry('style', id);
  for (const id of Object.keys(document.tokens)) registry('token', id);
  for (const id of Object.keys(document.conditions)) registry('condition', id);
  for (const id of Object.keys(document.assets)) registry('asset', id);

  const propOwner = (definition: string | undefined) =>
    JSON.stringify(['definition', definition ?? null]);
  const outputOwner = (scope: Scope, node: string | undefined, name: string | undefined) =>
    JSON.stringify([
      'output',
      scope.definition ?? null,
      scope.repeats.map((item) => item.id),
      node ?? null,
      name ?? null,
    ]);
  function reference(path: string, scope: Scope): string {
    const [head, name, ...rest] = path.split('.');
    if(scope.slot&&(head==='state'||head==='prop')&&name){
      const {owner,name:slotName,contract}=scope.slot;
      const declared=head==='state'?Object.hasOwn(contract.state??{},name):contract.props.some(prop=>prop.name===name);
      return b.add(head==='state'?'state':'prop',JSON.stringify(['slot',owner,slotName,path]),display(name),{
        kindLabel:head==='state'?'Scoped state':'Scoped prop',scope:`Slot ${owner}.${slotName}`,
        summary:'Per keyed slot instance; not document state',
        sourcePath:`/nodes/${segment(owner)}/slots/${segment(slotName)}/scope/${head==='state'?'state':'props'}/${segment(name)}`,
        ...(!declared?{support:'Unknown' as const}:{}),
      });
    }
    if (head === 'state' && name && !rest.length && document.localState[name])
      return registry('state', name);
    if (head === 'token' && name && !rest.length) return registry('token', name);
    let owner = 'document',
      kind = 'reference',
      label = path;
    if (head === 'prop') {
      owner = propOwner(scope.definition);
      kind = 'prop';
      label = name ?? path;
    } else if (head === 'repeat') {
      const repeat = [...scope.repeats].reverse().find((item) => item.name === name);
      owner = JSON.stringify([
        'repeat',
        scope.definition ?? null,
        scope.repeats.map((item) => item.id),
        repeat?.id ?? null,
      ]);
      kind = 'item';
      label = rest.join('.') || name || path;
    } else if (head === '$output') {
      owner = outputOwner(scope, scope.output?.node, scope.output?.name);
      kind = 'output';
      label = scope.output?.name ?? 'Output';
    } else if (head === 'view' || head === 'record') {
      kind = 'data';
      label = path.slice(head.length + 1);
    }
    return b.add(kind, JSON.stringify([owner, path]), display(label), {
      kindLabel: head === 'view' ? 'View' : head === 'record' ? 'Record' : display(kind),
      scope:
        head === 'prop'
          ? `Definition ${scope.definition ?? 'unknown'}`
          : head === 'repeat'
            ? `Repeat ${scope.repeats.map((item) => item.id).join(' / ')}`
            : head === '$output'
              ? `Component ${scope.output?.node ?? 'unknown'}`
              : head === 'record'
                ? 'Record data'
                : 'Document data',
      ...(head === 'prop'
        ? { summary: `Definition ${scope.definition ?? 'unknown'} · per-instance` }
        : head === 'repeat'
          ? { summary: `Repeat ${scope.repeats.map((item) => item.id).join(' / ')}` }
          : head === '$output'
            ? { summary: `Component ${scope.output?.node ?? 'unknown'}` }
            : {}),
      sourcePath: path,
      ...(owner.includes('null') &&
      ((head === 'prop' && !scope.definition) ||
        (head === 'repeat' && !scope.repeats.some((item) => item.name === name)) ||
        (head === '$output' && !scope.output))
        ? { support: 'Unknown' as const }
        : {}),
    });
  }
  function expression(
    value: UiExpression,
    to: string,
    path: string,
    role: RelationRole,
    scope: Scope,
    owner: string,
  ) {
    switch (value.type) {
      case 'literal':
        break;
      case 'ref':
        b.link(reference(value.path, scope), to, { role, path, owner });
        break;
      case 'compare':
        expression(value.left, to, `${path}/left`, role, scope, owner);
        expression(value.right, to, `${path}/right`, role, scope, owner);
        break;
      case 'boolean':
        value.terms.forEach((term, i) =>
          expression(term, to, `${path}/terms/${i}`, role, scope, owner),
        );
        break;
      case 'conditionalValue':
        expression(value.when, to, `${path}/when`, 'condition', scope, owner);
        expression(value.then, to, `${path}/then`, role, scope, owner);
        expression(value.otherwise, to, `${path}/otherwise`, role, scope, owner);
        break;
      case 'op':
        value.args.forEach((arg, i) =>
          expression(arg, to, `${path}/args/${i}`, role, scope, owner),
        );
        break;
      default:
        unreachable(value);
    }
  }
  function styleDeclarations(
    declarations: UiNode['localStyle'],
    to: string,
    path: string,
    scope: Scope,
    owner: string,
  ) {
    declarations?.forEach((declaration, i) => {
      const value = declaration.value,
        location = `${path}/${i}/value`;
      switch (value.type) {
        case 'text':
          break;
        case 'token':
          b.link(registry('token', value.id), to, { role: 'value', path: `${location}/id`, owner });
          break;
        case 'binding':
          expression(value.expression, to, `${location}/expression`, 'value', scope, owner);
          break;
        default:
          unreachable(value);
      }
    });
  }
  function condition(id: string, scope: Scope):string {
    const scoped=scope.slot?.contract.conditions?.[id];
    const source = document.conditions[id];
    const to = scoped&&scope.slot?b.add('condition',JSON.stringify(['slot',scope.slot.owner,scope.slot.name,id]),display(id),{kindLabel:'Scoped condition',scope:`Slot ${scope.slot.owner}.${scope.slot.name}`,summary:'Evaluated per keyed slot instance',sourcePath:`/nodes/${segment(scope.slot.owner)}/slots/${segment(scope.slot.name)}/scope/conditions/${segment(id)}`}):registry('condition', id);
    if(scoped)expression(scoped,to,`/nodes/${segment(scope.slot!.owner)}/slots/${segment(scope.slot!.name)}/scope/conditions/${segment(id)}`,'condition',scope,to);
    else if (source?.kind === 'localState')expression(source.when, to, `/conditions/${segment(id)}/when`, 'condition', scope, to);
    return to;
  }
  const styled = new Set<string>(),
    styledRegistry = new Set<string>();
  function appliedStyle(id: string, scope: Scope): string {
    const source = document.styleSources[id];
    const contextual = !!scope.definition || scope.repeats.length > 0;
    const to = contextual
      ? b.add('style', JSON.stringify([id, scopeKey(scope)]), display(id), {
          kindLabel: 'Style',
          registryId: id,
          scope: scope.definition
            ? `Definition ${scope.definition}`
            : `Repeat ${scope.repeats.map((item) => item.id).join(' / ')}`,
          sourcePath: `/styleSources/${segment(id)}`,
          ...(!source ? { support: 'Unknown' as const } : {}),
        })
      : registry('style', id);
    if (!source || styled.has(to)) return to;
    styled.add(to);
    styledRegistry.add(id);
    styleDeclarations(
      source.declarations,
      to,
      `/styleSources/${segment(id)}/declarations`,
      scope,
      to,
    );
    if (source.conditionId) {
      condition(source.conditionId, scope);
      b.link(registry('condition', source.conditionId), to, {
        role: 'condition',
        path: `/styleSources/${segment(id)}/conditionId`,
        owner: to,
      });
    }
    return to;
  }
  for (const id of Object.keys(document.styleSources)) {
    // Unused declarations are inventory entries, not falsely connected consumers.
    registry('style', id);
  }
  for (const definition of Object.values(document.componentDefinitions)) {
    const from = b.add('definition', definition.id, display(definition.id), {
      sourcePath: `/componentDefinitions/${segment(definition.id)}`,
      summary: `Revision ${definition.revision}`,
    });
    b.link(from, b.node(definition.root), {
      role: 'defines',
      path: `/componentDefinitions/${segment(definition.id)}/root`,
      owner: from,
    });
    for (const [slot, value] of Object.entries(definition.slots))
      value.fallback?.forEach((child, i) =>
        b.link(from, b.node(child), {
          role: 'fallback',
          path: `/componentDefinitions/${segment(definition.id)}/slots/${segment(slot)}/fallback/${i}`,
          owner: from,
          description: `Slot ${slot}`,
        }),
      );
    if (definition.baseStyle)
      b.link(appliedStyle(definition.baseStyle, { definition: definition.id, repeats: [] }), from, {
        role: 'styles',
        path: `/componentDefinitions/${segment(definition.id)}/baseStyle`,
        owner: from,
      });
    for (const [name, variant] of Object.entries(definition.variants ?? {}))
      b.link(registry('condition', variant.conditionId), from, {
        role: 'condition',
        path: `/componentDefinitions/${segment(definition.id)}/variants/${segment(name)}/conditionId`,
        owner: from,
        description: `Variant ${name}`,
      });
  }
  for (const node of Object.values(document.nodes)) {
    const to = b.node(node.id),
      nodePath = `/nodes/${segment(node.id)}`,
      contexts:Scope[] = [...(scopes.get(node.id)?.values() ?? [{ repeats: [] }])];
    const child = (id: string, role: RelationRole, path: string, description?: string) =>
      b.link(to, b.node(id), { role, path, owner: to, description });
    switch (node.kind) {
      case 'element':
      case 'portal':
        node.children.forEach((id, i) => child(id, 'contains', `${nodePath}/children/${i}`));
        break;
      case 'component':
        Object.entries(node.slots ?? {}).forEach(([name, fill]) =>
          fill.children.forEach((id, i) =>
            child(id, 'slot', `${nodePath}/slots/${segment(name)}/children/${i}`, `Slot ${name}`),
          ),
        );
        break;
      case 'repeat':
        child(node.templateRoot, 'template', `${nodePath}/templateRoot`);
        break;
      case 'slot':
        node.fallback?.forEach((id, i) =>
          child(id, 'fallback', `${nodePath}/fallback/${i}`, `Slot ${node.name}`),
        );
        break;
      case 'conditional':
        node.branches.forEach((branch, index) =>
          branch.children.forEach((id, i) =>
            child(
              id,
              branch.when ? 'branch' : 'otherwise',
              `${nodePath}/branches/${index}/children/${i}`,
              branch.when
                ? branchDescription(document, branch.when, index)
                : 'Final fallback branch',
            ),
          ),
        );
        break;
      case 'text':
        break;
      default:
        unreachable(node);
    }
    if (node.kind === 'portal')
      b.link(
        b.add('overlay', node.target.overlayId, node.target.overlayId, {
          kindLabel: 'Overlay',
          support: 'Unsupported',
          summary: 'Native portal rendering is unsupported',
        }),
        to,
        { role: 'overlay', path: `${nodePath}/target/overlayId`, owner: to },
      );
    if (node.kind === 'component') {
      const local = document.componentDefinitions[node.definitionId],
        descriptor = context.descriptors?.find(
          (d) =>
            d.id === node.definitionId &&
            (node.revision === undefined || d.revision === node.revision),
        );
      const target = local
        ? b.add('definition', node.definitionId, display(node.definitionId))
        : b.add(
            'catalog',
            `${node.definitionId}@${node.revision ?? descriptor?.revision ?? 'unresolved'}`,
            display(node.definitionId.replace(/^vict\.catalog\./, '')),
            {
              kindLabel: 'Library',
              summary: `Revision ${node.revision ?? descriptor?.revision ?? 'unresolved'}`,
              support: 'External',
              ...(descriptor?.inspectionLimits?.length
                ? { issues: [...descriptor.inspectionLimits] }
                : {}),
            },
          );
      b.link(to, target, { role: 'uses', path: `${nodePath}/definitionId`, owner: to });
      if (local)
        for (const [index, prop] of local.props.entries()) {
          if (!Object.hasOwn(node.props ?? {}, prop.name) && prop.default === undefined) continue;
          const parameter = reference(`prop.${prop.name}`, { definition: local.id, repeats: [] });
          b.link(to, parameter, {
            role: 'value',
            path: Object.hasOwn(node.props ?? {}, prop.name)
              ? `${nodePath}/props/${segment(prop.name)}`
              : `/componentDefinitions/${segment(local.id)}/props/${index}/default`,
            owner: to,
            description: `${Object.hasOwn(node.props ?? {}, prop.name) ? 'Instance assignment' : 'Definition default'}; per-instance prop ${prop.name}`,
          });
        }
    }
    for (const scope of contexts) {
      node.styleSources?.forEach((id, i) =>
        b.link(appliedStyle(id, scope), to, {
          role: 'styles',
          path: `${nodePath}/styleSources/${i}`,
          owner: to,
        }),
      );
      styleDeclarations(node.localStyle, to, `${nodePath}/localStyle`, scope, to);
      switch (node.kind) {
        case 'element':
          Object.entries(node.attributes ?? {}).forEach(([key, value]) => {
            if (typeof value !== 'string')
              expression(value, to, `${nodePath}/attributes/${segment(key)}`, 'value', scope, to);
          });
          break;
        case 'text':
          if (node.content.type === 'expression')
            expression(
              node.content.expression,
              to,
              `${nodePath}/content/expression`,
              'value',
              scope,
              to,
            );
          break;
        case 'repeat':
          expression(node.collection, to, `${nodePath}/collection`, 'items', scope, to);
          expression(
            node.key,
            to,
            `${nodePath}/key`,
            'key',
            { ...scope, repeats: [...scope.repeats, { id: node.id, name: node.itemName }] },
            to,
          );
          break;
        case 'conditional':
          node.branches.forEach((branch, i) => {
            if (branch.when) {
              const target=condition(branch.when, scope);
              b.link(target, to, {
                role: 'condition',
                path: `${nodePath}/branches/${i}/when`,
                owner: to,
              });
            }
          });
          break;
        case 'component':
          Object.entries(node.props ?? {}).forEach(([name, value]) =>
            expression(value, to, `${nodePath}/props/${segment(name)}`, 'value', scope, to),
          );
          break;
        case 'slot':
        case 'portal':
          break;
        default:
          unreachable(node);
      }
      const action = (
        id: string,
        path: string,
        input: Readonly<Record<string, UiExpression>> | undefined,
        bindingScope: Scope,
        from = to,
      ) => {
        const target = b.add('action', id, display(id), {
          kindLabel: 'Action',
          support: context.actionIds && !context.actionIds.includes(id) ? 'Unknown' : 'External',
          summary: context.actionState?.[id]
            ? 'Configured host connection'
            : 'External action; return wiring unavailable',
        });
        b.link(from, target, { role: 'invokes', path, owner: to });
        Object.entries(input ?? {}).forEach(([name, value]) =>
          expression(value, target, `${path}/input/${segment(name)}`, 'payload', bindingScope, to),
        );
      };
      node.interactions?.forEach((interaction, i) => {
        const path = `${nodePath}/interactions/${i}`;
        switch (interaction.action) {
          case 'setState':
            b.link(to, reference(`state.${interaction.key}`,scope), { role: 'updates', path, owner: to });
            expression(interaction.value, to, `${path}/value`, 'fallback', scope, to);
            break;
          case 'invokeAction':
            action(interaction.actionId, path, interaction.input, scope);
            break;
          case 'navigate': {
            const target = b.add('route', interaction.routeId, display(interaction.routeId), {
              kindLabel: 'Route',
              support:
                context.routeIds && !context.routeIds.includes(interaction.routeId)
                  ? 'Unknown'
                  : 'External',
              summary: 'Declared route; page contents are outside this document',
            });
            b.link(to, target, { role: 'navigates', path, owner: to });
            Object.entries(interaction.params ?? {}).forEach(([name, value]) =>
              expression(value, target, `${path}/params/${segment(name)}`, 'payload', scope, to),
            );
            break;
          }
          default:
            unreachable(interaction);
        }
      });
      if (node.kind === 'component')
        for (const [name, binding] of Object.entries(node.outputs ?? {})) {
          const path = `${nodePath}/outputs/${segment(name)}`,
            outputScope = { ...scope, output: { node: node.id, name } };
          const output = b.add(
            'output',
            JSON.stringify([outputOwner(scope, node.id, name), '$output']),
            display(name),
            {
              kindLabel: 'Output',
              scope: `Component ${node.id}`,
              summary: `Component ${node.id}`,
              sourcePath: path,
            },
          );
          b.link(to, output, { role: 'emits', path, owner: to });
          if ('setState' in binding) {
            b.link(output, reference(`state.${binding.setState.key}`,scope), {
              role: 'updates',
              path: `${path}/setState`,
              owner: to,
            });
            if (
              binding.setState.value &&
              !(binding.setState.value.type === 'ref' && binding.setState.value.path === '$output')
            )
              expression(
                binding.setState.value,
                reference(`state.${binding.setState.key}`,scope),
                `${path}/setState/value`,
                'payload',
                outputScope,
                to,
              );
          } else if ('invokeAction' in binding)
            action(
              binding.invokeAction.actionId,
              `${path}/invokeAction`,
              binding.invokeAction.input,
              outputScope,
              output,
            );
          else if ('emit' in binding) {
            const target=b.add('output',JSON.stringify([scope.slot?.owner,scope.slot?.name,path,'scoped',binding.emit.output]),display(binding.emit.output),{kindLabel:'Scoped output',scope:'Authored slot instance',summary:'Declared scoped intent; no backend execution',sourcePath:`${path}/emit`});
            b.link(output,target,{role:'emits',path:`${path}/emit`,owner:to});
            if(binding.emit.value)expression(binding.emit.value,target,`${path}/emit/value`,'payload',outputScope,to);
          } else unreachable(binding);
        }
    }
  }
  for (const id of Object.keys(document.styleSources))
    if (!styledRegistry.has(id)) appliedStyle(id, { repeats: [] });
  for (const [action, connection] of Object.entries(context.actionState ?? {})) {
    const from = b.add('action', action, display(action), {
      kindLabel: 'Action',
      support: 'External',
      summary: 'Configured host connection',
    });
    for (const role of ['pending', 'error', 'result'] as const) {
      const key = connection[role];
      if (key)
        b.link(from, registry('state', key), {
          role,
          path: `/actionState/${segment(action)}/${role}`,
          owner: from,
          origin: 'host',
        });
    }
    for (const key of Object.keys(connection.successValues ?? {}))
      b.link(from, registry('state', key), {
        role: 'success',
        path: `/actionState/${segment(action)}/successValues/${segment(key)}`,
        owner: from,
        origin: 'host',
      });
  }
}
