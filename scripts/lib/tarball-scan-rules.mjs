/**
 * Pure tarball-scan rules for the trusted-publishing release path
 * (contract §9 of docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md).
 *
 * Extracted from scripts/scan-release-tarballs.mjs so the frozen
 * forbidden-content, forbidden-local-path, and path-allowlist rules carry
 * permanent regression coverage. All functions are pure; nothing here
 * performs I/O.
 */

/**
 * Forbidden CONTENT patterns (credentials). Every pattern is checked
 * against every archived file; code files are comment-stripped first
 * (scripts/lib/import-scan.mjs discipline).
 */
export const FORBIDDEN_CONTENT_PATTERNS = [
  { id: 'auth-token-config-line', pattern: /\/\/registry\.npmjs\.org\/:_authToken/ },
  { id: 'auth-token-assignment', pattern: /_authToken\s*[=:] ?\S/ },
  { id: 'node-auth-token-name', pattern: /\bNODE_AUTH_TOKEN\b/ },
  { id: 'npm-token-name', pattern: /\bNPM_TOKEN\b/ },
  { id: 'npm-granular-token-format', pattern: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { id: 'github-token-format', pattern: /\bgh(?:p|o|u|s)_[A-Za-z0-9]{36,}\b/ },
  { id: 'github-fine-grained-token-format', pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { id: 'aws-access-key-id-format', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'private-key-block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'slack-token-format', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
];

/**
 * Forbidden LOCAL-PATH patterns. Deliberately tight (checked against the
 * real 0.2.0 artifacts so legitimate embedded template text — e.g. the
 * scaffolder's `\${...}` emission templates — can never false-positive).
 */
export const FORBIDDEN_LOCAL_PATH_PATTERNS = [
  { id: 'windows-users-path', pattern: /[A-Za-z]:\\+Users\\/ },
  { id: 'windows-system-path', pattern: /[A-Za-z]:\\+(?:Windows|Program Files)\\/ },
  { id: 'unix-home-path', pattern: /\/home\/[A-Za-z0-9._-]+\/?/ },
  { id: 'unix-macos-user-path', pattern: /\/Users\/[A-Za-z0-9._-]+\/?/ },
  { id: 'wsl-or-runner-mnt-path', pattern: /\/mnt\/[A-Za-z0-9._-]+\/?/ },
];

/** npm always archives these root files regardless of `files`. */
export const NPM_MANDATED_ROOT_FILES = [
  /^package\.json$/,
  /^README(?:\.md|\.txt)?$/i,
  /^LICEN[SC]E(?:\.md|\.txt)?$/i,
];

export const COMMENTED_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.jsx',
  '.tsx',
]);

export const FORBIDDEN_DEPENDENCY_PROTOCOLS = /^(?:workspace:|file:|link:|git(?:\+[^:]+:)?\/\/)/;

/** The release-relevant manifest fields that must match byte-truthfully. */
export const COMPARED_MANIFEST_FIELDS = [
  'name',
  'version',
  'license',
  'engines',
  'repository',
  'publishConfig',
  'files',
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
];

/** Strip comments the same way the verifier path gates do. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
}

/**
 * Path allowlist: every archived path must live inside `package/`, must
 * not contain ANY dotfile segment, and must be covered by one of the
 * manifest's declared `files` entries (or be an npm-mandated root file).
 *
 * @param {string[]} archivedPaths paths as listed by `tar -t`
 * @param {string[] | undefined} filesEntries the manifest's `files`
 * @param {string[]} findings accumulator for violations
 * @param {string} tarballName display name for findings
 */
export function checkPathAllowlist(archivedPaths, filesEntries, findings, tarballName) {
  for (const rawPath of archivedPaths) {
    const normalized = rawPath.replace(/\\/g, '/');
    if (!normalized.startsWith('package/')) {
      findings.push(`${tarballName}: archived path outside package/: ${rawPath}`);
      continue;
    }
    const relative = normalized.slice('package/'.length);
    if (relative.length === 0) continue;
    const segments = relative.split('/');
    if (segments.some((segment) => segment.startsWith('.'))) {
      findings.push(`${tarballName}: dotfile archived: ${relative}`);
      continue;
    }
    const isMandated =
      segments.length === 1 && NPM_MANDATED_ROOT_FILES.some((pattern) => pattern.test(relative));
    if (isMandated) continue;
    const covered = (filesEntries ?? []).some(
      (entry) => relative === entry || relative.startsWith(`${entry}/`),
    );
    if (!covered) {
      findings.push(
        `${tarballName}: archived file '${relative}' is outside the manifest 'files' declaration (${JSON.stringify(filesEntries ?? [])})`,
      );
    }
  }
}

/**
 * Manifest truth: the packed package.json must equal the workspace
 * manifest on every compared field, and its dependency specifiers must
 * carry no workspace/file/link/git+ protocol.
 */
export function checkPackedManifest(packedManifest, workspaceManifest, findings, tarballName) {
  for (const field of COMPARED_MANIFEST_FIELDS) {
    const packedValue = packedManifest[field];
    const workspaceValue = workspaceManifest[field];
    if (JSON.stringify(packedValue ?? null) !== JSON.stringify(workspaceValue ?? null)) {
      findings.push(
        `${tarballName}: packed manifest '${field}' differs from the workspace manifest`,
      );
    }
  }
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = packedManifest[section];
    if (deps === undefined || typeof deps !== 'object') continue;
    for (const [depName, specifier] of Object.entries(deps)) {
      if (typeof specifier === 'string' && FORBIDDEN_DEPENDENCY_PROTOCOLS.test(specifier)) {
        findings.push(
          `${tarballName}: packed manifest ${section}['${depName}'] uses a forbidden protocol specifier ('${specifier}')`,
        );
      }
    }
  }
}

/**
 * Content rules for one archived file's text (comment-stripped for code
 * files, raw latin1 otherwise).
 */
export function checkText(text, findings, tarballName, relative) {
  for (const { id, pattern } of FORBIDDEN_CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      findings.push(`${tarballName}: ${relative}: forbidden content (${id})`);
    }
  }
  for (const { id, pattern } of FORBIDDEN_LOCAL_PATH_PATTERNS) {
    if (pattern.test(text)) {
      findings.push(`${tarballName}: ${relative}: forbidden local absolute path (${id})`);
    }
  }
}
