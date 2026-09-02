/**
 * Testing utilities for `@vict/application`. Import from
 * `@vict/application/testing`.
 *
 * Includes the shared renderer and application-data adapter conformance
 * suites: every conforming renderer or data adapter must pass the same
 * behavioral source.
 */
export { runRendererConformanceSuite } from './renderer-conformance.js';
export type { RendererConformanceFixture } from './renderer-conformance.js';
export { runApplicationDataAdapterSuite } from './data-conformance.js';
export type { ApplicationDataAdapterFixture } from './data-conformance.js';
