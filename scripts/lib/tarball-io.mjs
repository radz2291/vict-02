/**
 * Tar reading for the trusted-publishing release path.
 *
 * The platform `tar` is the only archive reader used (present on GitHub
 * runners and in Git Bash environments). Windows GNU tar interprets
 * `X:\...` as a remote host:path, so Windows invocations use forward
 * slashes plus `--force-local` through the shell; POSIX invocations are
 * plain argument arrays.
 */

import { execFileSync } from 'node:child_process';

const IS_WINDOWS = process.platform === 'win32';

function tarArgs(baseArgs, tgzPath) {
  const normalized = IS_WINDOWS ? tgzPath.replace(/\\/g, '/') : tgzPath;
  return IS_WINDOWS ? ['--force-local', ...baseArgs, normalized] : [...baseArgs, normalized];
}

/**
 * Read one archived member of a tarball as text (e.g.
 * `package/package.json` for identity checks).
 *
 * @param {string} tgzPath tarball path
 * @param {string} member archived member path
 * @returns {string} the member's text content
 */
export function readTarballMember(tgzPath, member) {
  return execFileSync('tar', tarArgs(['-xOzf'], tgzPath).concat([member]), {
    encoding: 'utf8',
    shell: IS_WINDOWS,
  });
}
