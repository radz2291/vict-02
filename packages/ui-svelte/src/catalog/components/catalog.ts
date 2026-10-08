/** Public reusable authoring registrations for the available VICT catalog. */
import { b1CatalogDescriptors } from './descriptors.js';
import { b1CatalogImplementations } from './implementations.js';
import { b2CatalogDescriptors } from './b2-descriptors.js';
import { b2CatalogImplementations } from './b2-implementations.js';
import { b3CatalogDescriptors } from './b3-descriptors.js';
import { b3CatalogImplementations } from './b3-implementations.js';
import { b4CatalogDescriptors } from './b4-descriptors.js';
import { b4CatalogImplementations } from './b4-implementations.js';
import { b5CatalogDescriptors } from './b5-descriptors.js';
import { b5CatalogImplementations } from './b5-implementations.js';
export const catalogDescriptors = [...b1CatalogDescriptors, ...b2CatalogDescriptors, ...b3CatalogDescriptors, ...b4CatalogDescriptors, ...b5CatalogDescriptors] as const;
export const catalogImplementations = [...b1CatalogImplementations, ...b2CatalogImplementations, ...b3CatalogImplementations, ...b4CatalogImplementations, ...b5CatalogImplementations] as const;
