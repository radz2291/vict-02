import { mount } from 'svelte';
import Workbench from './Workbench.svelte';

const target = document.getElementById('app');
if (target === null) throw new Error('#app missing');
mount(Workbench, { target });
