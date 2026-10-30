import { writeFileSync } from 'node:fs';
import { authoringDigest, authoringImplementationCapabilities } from '../../ui/src/authoring.js';
import { mediaAuthoringDescriptors } from '../src/descriptors.js';
const pins = mediaAuthoringDescriptors.map((d) => ({
  id: d.id,
  revision: d.revision,
  descriptorDigest: authoringDigest(d),
  capabilitiesDigest: authoringDigest(
    authoringImplementationCapabilities({
      extensionId: d.id,
      revision: d.revision,
      rendererImplementationId: d.rendererImplementationId!,
      abi: d.abi,
      styleTargets: d.styleTargets,
      slots: [],
    }),
  ),
}));
writeFileSync(
  new URL('../src/compatibility.json', import.meta.url),
  JSON.stringify(pins, null, 2) + '\n',
);
