'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Load KEY=VALUE pairs from `path.join(projectRoot, '.env')` into `process.env`
 * when not already set. Matches the original build-chapter.js regex parser.
 *
 * Use as the very first statement in any script that needs project credentials:
 *
 *   const { loadRootEnv } = require('../lib/env');
 *   loadRootEnv();
 *
 * After this call, process.env contains every key in .env, and existing
 * shell env always wins (no accidental override of CI-supplied secrets).
 */
function loadRootEnv(root = path.resolve(__dirname, '..')) {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return { loaded: 0, path: envPath };
  let loaded = 0;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      loaded += 1;
    }
  }
  return { loaded, path: envPath };
}

module.exports = { loadRootEnv };
