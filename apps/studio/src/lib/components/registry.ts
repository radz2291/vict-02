import { createComponentRegistry } from '@victframework/application/renderer';
import type { ComponentRegistry } from '@victframework/application/renderer';

/**
 * STUDIO COMPONENT REGISTRY — BUILDER TRACK `studio-app` OWNS THIS FILE
 * (and `src/lib/components/**`).
 *
 * This scaffold stub exists only so integration typechecks before the real
 * registry lands. Replace it with the trusted local registry carrying the
 * NAMED, justified custom operator component(s) — expected:
 * `cmp.target-connection-status` (the four truthful target connection
 * states). Required export (signature is the interface; do not change it):
 *
 *   createStudioRegistry(): ComponentRegistry
 */
export function createStudioRegistry(): ComponentRegistry {
  return createComponentRegistry('registry.studio', '1');
}
