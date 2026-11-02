"""Read-only integration ancestry, production equality, routing and link audit."""
from pathlib import Path
import json, re, subprocess

root = Path.cwd()
evidence = root / 'docs/studio/foundation-evidence/mainline-integration-20261102'
git = lambda *args: subprocess.check_output(['git', *args], text=True, encoding='utf-8').strip()
candidate = 'f7ef931628454c40a47136aea2b2e54119f9b507'
delivery = 'ed771858fb1d3a28783d320785a3cab1bbe3f341'
product = '2de11bc7719984f23341852b1cc8b9985ff81adf'
base = 'd7401bef6e48330796c74ec00c86db9622d48cdf'
for parent, child in [(base, delivery), (delivery, candidate), (candidate, 'HEAD')]:
    subprocess.check_call(['git', 'merge-base', '--is-ancestor', parent, child])
allowed_tests = {
    'packages/ui-editor/test/classes.test.ts',
    'packages/ui-editor/test/contextual-catalog.svelte.test.ts',
    'packages/ui-editor/test/floating-selection.svelte.test.ts',
    'apps/studio/tests/nested-route-guidance-schema.test.ts',
    'apps/studio/tests/ui/authoring-foundation-turn-history.test.ts',
    'apps/studio/tests/ui/structure-workspace.test.ts',
    'apps/studio/tests/ui/structure-portals.test.ts',
    'apps/studio/tests/structure-semantics.test.ts',
}
production_repairs = {'packages/ui-svelte/src/catalog/components/CatalogDialog.svelte', 'packages/ui-svelte/src/catalog/components/CatalogPortal.svelte', 'packages/ui-structure-svelte/src/structure-semantics.ts', 'packages/ui-structure-svelte/src/structure-behavior.ts'}
changes = git('diff', '--name-only', product, 'HEAD').splitlines()
assert all(p.startswith('docs/') or p == 'AGENTS.md' or p in allowed_tests or p in production_repairs for p in changes), changes
assert production_repairs <= set(changes)
assert not git('diff', '--name-only', candidate, '--', 'packages', 'apps', 'scripts', 'package.json', 'package-lock.json', 'vitest.config.ts')
for path in root.glob('packages/*/package.json'):
    manifest = json.loads(path.read_text(encoding='utf-8'))
    installed = root / 'node_modules' / manifest['name']
    assert installed.resolve() == path.parent.resolve(), (manifest['name'], installed.resolve())
links = 0
changed_docs = [p for p in git('diff', '--name-only', delivery).splitlines() if p.endswith('.md')]
for path in changed_docs:
    diff = git('diff', '--unified=0', delivery, '--', path)
    added = '\n'.join(line[1:] for line in diff.splitlines() if line.startswith('+') and not line.startswith('+++'))
    for target in re.findall(r'\]\(([^)]+)\)', added):
        if '://' in target:
            continue
        filename, sep, anchor = target.partition('#')
        destination = root / Path(path).parent / filename if filename else root / path
        assert destination.exists(), (path, target)
        if sep:
            assert destination.is_file(), (path, target)
            headings = re.findall(r'^#{1,6} +(.+)$', destination.read_text(encoding='utf-8'), re.M)
            slugs = [re.sub(r'[^\w\- ]', '', h.lower()).replace(' ', '-') for h in headings]
            assert anchor in slugs, (path, target)
        links += 1
for path in ['docs/governance/VICT-STAGE-09-STATE.md', 'docs/handoff/VICT-STAGE-09-STUDIO-HANDOFF.md', 'docs/ui-foundation/STATE.md', 'docs/ui-foundation/HANDOFF.md']:
    text = (root / path).read_text(encoding='utf-8')
    assert 'FOUNDATION-MAINLINE-INTEGRATION-20261102.md' in text.split('## Current', 1)[0], path
status = (root / 'docs/studio/AUTHORING-FOUNDATION-CURRENT-STATUS.md').read_text(encoding='utf-8')
for required in ['Stage 9 remains OPEN', 'Milestone 2 is PAUSED', 'open finding', 'current Studio agent remains available', 'revision/occurrence protections', 'Undo/Redo and Save/reopen']:
    assert required in status, required
report = {'status': 'PASS', 'testedCandidate': candidate, 'auditedHead': git('rev-parse', 'HEAD'), 'base': base, 'delivery': delivery, 'historicalProductionSource': product, 'productionChangesSinceProduct': sorted(production_repairs), 'testRepairs': sorted(allowed_tests), 'addedRelativeLinksChecked': links, 'entryRoutes': 'Stage9 and UI foundation -> integration/current delivery -> current status/acceptance/TORI future requirement', 'workspaceIsolation': 'all installed package links point inside integration checkout', 'scope': 'Documentation/topology/source-change audit, not product runtime or whole-repository test verdict.'}
(evidence / 'documentation-and-equality.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
