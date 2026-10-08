import { mount } from 'svelte';
import FinishedApp from './FinishedApp.svelte';

const target = document.getElementById('app');
if (target === null) throw new Error('#app missing');
mount(FinishedApp, { target });
