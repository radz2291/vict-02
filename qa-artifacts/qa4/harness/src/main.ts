import { mount } from 'svelte';
import Harness from './Harness.svelte';

const app = mount(Harness, { target: document.getElementById('app')! });

export default app;
