import { writable } from 'svelte/store';

export const activeRoute = writable('sandbox');
export const glossarySearch = writable('');
export const hoveredPosition = writable(null);
export const selectedFormation = writable(null);
export const glossaryOpen = writable(false);
export const glossaryTerm = writable(null);
