#!/usr/bin/env node
/**
 * vict-builder-kit CLI shim. Runs the package's built API from ./dist
 * (build first: `npm run build -w @victframework/builder-kit`). In the VICT
 * workspace the npm scripts run the CLI from source through tsx.
 */
import { runCli } from '../dist/index.js';

process.exit(runCli(process.argv.slice(2)));
