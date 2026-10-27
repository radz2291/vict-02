/** Run deliberately after authoring-contract review, not during installation/build. */
import { writeFileSync } from 'node:fs';
import { authoringDigest, authoringImplementationCapabilities } from '../../ui/src/authoring.js';
import { patternAuthoringDescriptors } from '../src/authoring/descriptors.js';
const pins = patternAuthoringDescriptors.map((descriptor) => ({
  id: descriptor.id,
  revision: descriptor.revision,
  descriptorDigest: authoringDigest(descriptor),
  capabilitiesDigest: authoringDigest(
    authoringImplementationCapabilities({
      extensionId: descriptor.id,
      revision: descriptor.revision,
      rendererImplementationId: descriptor.rendererImplementationId!,
      abi: 'vict.ui-component-abi@1',
      slots: descriptor.slots,
      styleTargets: descriptor.styleTargets,
    }),
  ),
}));
writeFileSync(
  new URL('../src/authoring/compatibility.json', import.meta.url),
  `${JSON.stringify(pins, null, 2)}\n`,
);
