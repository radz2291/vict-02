# Gate battery at the integrated VICT main 2e65bab (Windows fresh checkout)

npm ci: exit 0
root unit BEFORE workspace build: 6 failed / 2828 passed / 5 skipped (2839 total; 5 files)
  FAIL scripts/test/bootstrap-artifact.test.mjs (module load)
  FAIL packages/kernel/test/agent-profile-identity.test.ts > same semantics produce the same version across child processes
  FAIL packages/server/test/restart-sigkill.test.ts > 3 SIGKILL cross-store tests
  FAIL packages/scaffolder/test/scaffolder.test.ts > generated project build
  FAIL packages/store-sqlite/test/agent-governance-corrective.test.ts > fresh process restore (dist entry missing)
PRE-G3 BASELINE 510ef7e fresh checkout: IDENTICAL 6-failure set (5 files) => documented environmental class CONFIRMED
after npm run build (exit 0): studio suite 97/97 exit 0; apps/studio check exit 0; root lint exit 0; prettier --check clean; verify:stage9-inventory: INVENTORY OK, G1 reads UNAMENDED, G2 surface accounted

Quellight 40b6c35: npm ci REFUSES (no/lockfile desync) => retained finding L-1 reproduced; npm install then tree restored byte-pure (porcelain empty, HEAD 40b6c35 before and after all live work)
