/**
 * Shared npm launcher resolution for the trust interface (contract §11:
 * npm >= 11.15.0 required for `npm trust`).
 *
 * Order: $NPM_BIN (explicit operator override), the active `npm`, then
 * the pinned npm through `npx -y npm@<pinned>`. Returns
 * `{ command, prefix, description }`. No credentials are involved.
 */

import { spawnSync } from 'node:child_process';
import { npmVersionSatisfiesMinimum } from './release-set.mjs';

export const PINNED_NPM_VERSION = '11.19.1';

function npmVersionOf(command, args) {
  const result = spawnSync(command, [...args, '--version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32' && command !== process.execPath,
  });
  if (result.status !== 0) return undefined;
  return (result.stdout ?? '').trim().split(/\r?\n/).at(-1);
}

/**
 * Resolve an npm launcher that satisfies the `npm trust` minimum.
 * Throws a plain Error with an operator-actionable message when no
 * qualifying launcher can be resolved.
 */
export function resolveNpmLauncher() {
  if (process.env.NPM_BIN !== undefined && process.env.NPM_BIN.length > 0) {
    const version = npmVersionOf(process.env.NPM_BIN, []);
    if (version === undefined) {
      throw new Error(`NPM_BIN '${process.env.NPM_BIN}' could not report a version.`);
    }
    if (!npmVersionSatisfiesMinimum(version)) {
      throw new Error(`NPM_BIN npm ${version} is older than the required 11.15.0.`);
    }
    return { command: process.env.NPM_BIN, prefix: [], description: `NPM_BIN (npm ${version})` };
  }
  const active = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const activeVersion = npmVersionOf(active, []);
  if (activeVersion !== undefined && npmVersionSatisfiesMinimum(activeVersion)) {
    return {
      command: active,
      prefix: [],
      description: `active npm (${activeVersion})`,
    };
  }
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const pinnedVersion = npmVersionOf(npx, ['-y', `npm@${PINNED_NPM_VERSION}`]);
  if (pinnedVersion === undefined) {
    throw new Error(`could not run npm ${PINNED_NPM_VERSION} through npx for the trust interface.`);
  }
  return {
    command: npx,
    prefix: ['-y', `npm@${PINNED_NPM_VERSION}`],
    description: `npx npm@${PINNED_NPM_VERSION} (active npm ${activeVersion ?? 'unknown'} is too old)`,
  };
}
