import {mount} from 'svelte';
import Host from './AdversarialHost.svelte';
export function run(target:HTMLElement){return mount(Host,{target});}
