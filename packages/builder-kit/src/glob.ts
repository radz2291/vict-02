/**
 * Minimal dependency-free glob matcher for in-scope path sets and
 * detection ignore manifests.
 *
 * Supported syntax (repository-relative, forward slashes):
 * - `dir` followed by slash-star-star matches everything under `dir`;
 * - `a` slash star slash `b` matches one path segment between them;
 * - `star.ext` matches within one segment;
 * - star-star slash `name` matches `name` at any depth;
 * - exact paths match exactly.
 */

export function globToRegExp(pattern: string): RegExp {
  let regex = '';
  let index = 0;
  while (index < pattern.length) {
    const char = pattern.charAt(index);
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        // `**` — any number of segments. Consume the following slash too.
        if (pattern[index + 2] === '/') {
          regex += '(?:.*/)?';
          index += 3;
        } else {
          regex += '.*';
          index += 2;
        }
        continue;
      }
      regex += '[^/]*';
      index += 1;
      continue;
    }
    if (char === '?') {
      regex += '[^/]';
      index += 1;
      continue;
    }
    regex += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    index += 1;
  }
  return new RegExp(`^${regex}$`);
}

export function matchesAny(path: string, patterns: readonly string[]): boolean {
  const normalized = path.replace(/\\/g, '/');
  return patterns.some((pattern) => {
    const regExp = globToRegExp(pattern.replace(/\\/g, '/'));
    if (regExp.test(normalized)) return true;
    // `dir/**` also commonly intends the directory prefix itself for
    // write-scope purposes; keep detection strict (no prefix relaxation).
    return false;
  });
}
