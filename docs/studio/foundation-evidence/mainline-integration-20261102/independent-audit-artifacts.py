"""Independent, read-only public tar/source/installed-file association audit.

Run from the integration checkout with consumer-report path and output path.
Original reports and archive bytes are never rewritten.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys
import tarfile

root = Path.cwd()
report_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
report = json.loads(report_path.read_text(encoding='utf-8-sig'))
assert report['status'] == 'PASS'
sha = lambda value: hashlib.sha256(value).hexdigest()
consumer = Path(report['consumer'])
rows = []
all_members = nonmanifest_members = 0
for pack in report['packs']:
    archive = Path(pack['path'])
    assert sha(archive.read_bytes()) == pack['sha256'], pack['name']
    name = pack['name'].split('/')[-1]
    source_tree = subprocess.check_output(
        ['git', 'rev-parse', report['sourceCandidate'] + ':packages/' + name],
        text=True,
    ).strip()
    build = next(item for item in report['packageBuilds'] if item['name'] == pack['name'])
    assert build['sourceTree'] == source_tree
    installed = consumer / 'node_modules' / pack['name']
    assert installed.resolve().is_relative_to(consumer.resolve()), installed
    with tarfile.open(archive, 'r:gz') as tar:
        members = {
            item.name.removeprefix('package/'): tar.extractfile(item).read()
            for item in tar.getmembers() if item.isfile()
        }
    assert set(members) == {item['path'] for item in pack['files']}
    for item in pack['files']:
        assert sha(members[item['path']]) == item['sha256'], item
        assert sha((installed / item['path']).read_bytes()) == item['sha256'], item
    source_manifest = json.loads((root / 'packages' / name / 'package.json').read_text(encoding='utf-8'))
    installed_manifest = json.loads((installed / 'package.json').read_text(encoding='utf-8'))
    for field in ['name', 'version', 'type', 'exports', 'dependencies', 'peerDependencies', 'optionalDependencies', 'private', 'files']:
        assert source_manifest.get(field) == installed_manifest.get(field), (name, field)
    total = len(members)
    nonmanifest = sum(path != 'package.json' for path in members)
    all_members += total
    nonmanifest_members += nonmanifest
    rows.append({'name': pack['name'], 'archiveSha256': pack['sha256'], 'sourceTree': source_tree, 'mode': build['mode'], 'allFilesMatched': total, 'nonmanifestFilesMatched': nonmanifest})
for item in report['fixtureFiles']:
    assert sha((consumer / item['path']).read_bytes()) == item['sha256'], item
for path in [*(consumer / 'src').glob('*'), consumer / 'vite.config.mjs']:
    if path.is_file():
        assert not re.search(r'apps/studio|\$lib|alias\s*:', path.read_text(encoding='utf-8')), path
result = {
    'status': 'PASS', 'reviewer': '/root/mainline_independent_verifier',
    'testedCandidate': report['sourceCandidate'], 'consumer': str(consumer),
    'reportSha256': sha(report_path.read_bytes()), 'archives': len(rows),
    'allTarAndInstalledMembersMatched': all_members,
    'nonmanifestMembersMatched': nonmanifest_members,
    'manifestSemanticsMatched': len(rows), 'fixtureFilesMatched': len(report['fixtureFiles']),
    'installedPackagesStayInsideConsumer': True, 'sourceAliasOrStudioImports': False,
    'packages': rows,
}
output_path.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: value for key, value in result.items() if key != 'packages'}, indent=2))
