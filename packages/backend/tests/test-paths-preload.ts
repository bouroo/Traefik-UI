// Shared preload: set DYNAMIC_CONFIG_PATH and ACCESS_LOG_PATH to temp files
// BEFORE any other test file imports the app.
//
// Imported as a static import in test files; ESM guarantees this module's
// top-level code runs to completion before the importing file's body.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'traefik-ui-path-preload-'));
const dynamicConfigPath = join(dir, 'dynamic.yml');
const accessLogPath = join(dir, 'access.log');

process.env.DYNAMIC_CONFIG_PATH = dynamicConfigPath;
process.env.ACCESS_LOG_PATH = accessLogPath;

export const SHARED_DYNAMIC_CONFIG_PATH = dynamicConfigPath;
export const SHARED_ACCESS_LOG_PATH = accessLogPath;
export const SHARED_TMP_DIR = dir;

// Patches the runtime `config.paths` to use the shared temp paths.
// Must be called AFTER helpers (which imports config) is loaded.
export async function patchConfigPaths(): Promise<void> {
  const { config } = await import('../src/config');
  (config.paths as Record<string, string>).dynamicConfig = dynamicConfigPath;
  (config.paths as Record<string, string>).accessLog = accessLogPath;
}
