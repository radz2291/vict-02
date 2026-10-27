import type { UiSvelteComponentImplementation } from '@victframework/ui-svelte';
import Image from './Image.svelte';
import Video from './Video.svelte';
import Embed from './Embed.svelte';
import Icon from './Icon.svelte';
import Vector from './Vector.svelte';
import AssetLibrary from './AssetLibrary.svelte';
import { mediaAuthoringDescriptors } from './descriptors.js';
const components = [Image, Video, Embed, Icon, Vector, AssetLibrary] as const;
export const mediaAuthoringImplementations: readonly UiSvelteComponentImplementation[] =
  mediaAuthoringDescriptors.map((descriptor, index) => ({
    extensionId: descriptor.id,
    revision: descriptor.revision,
    rendererImplementationId: descriptor.rendererImplementationId!,
    abi: 'vict.ui-component-abi@1',
    styleTargets: descriptor.styleTargets,
    slots: [],
    component: components[index]!,
  }));
