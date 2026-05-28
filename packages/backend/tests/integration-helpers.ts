// Set up environment variables BEFORE any source module is imported.
import './integration-env';

// ---- Container runtime detection ----

let _runtime: 'podman' | 'docker' | null = null;
let _runtimePath: string | null = null;

function resolveBinary(name: string): string | null {
  const commonPaths = [
    `/opt/podman/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
  ];

  for (const p of commonPaths) {
    try {
      const result = Bun.spawnSync({ cmd: [p, '--version'], stdout: 'pipe', stderr: 'pipe' });
      if (result.exitCode === 0) return p;
    } catch {
      /* continue */
    }
  }

  try {
    const result = Bun.spawnSync({ cmd: [name, '--version'], stdout: 'pipe', stderr: 'pipe' });
    if (result.exitCode === 0) return name;
  } catch {
    /* continue */
  }

  return null;
}

export function detectContainerRuntime(): 'podman' | 'docker' {
  if (_runtime) return _runtime;

  const podmanPath = resolveBinary('podman');
  if (podmanPath) {
    _runtime = 'podman';
    _runtimePath = podmanPath;
    return _runtime;
  }

  const dockerPath = resolveBinary('docker');
  if (dockerPath) {
    _runtime = 'docker';
    _runtimePath = dockerPath;
    return _runtime;
  }

  throw new Error('Neither podman nor docker is available on this system');
}

// ---- Container lifecycle ----

const TEST_DYNAMIC_CONFIG = `${import.meta.dir}/traefik-test-dynamic.yml`;

export async function startTraefikContainer(): Promise<{ apiUrl: string; containerId: string }> {
  detectContainerRuntime(); // ensures _runtimePath is set
  const runtimePath = _runtimePath!;
  const image = 'docker.io/library/traefik:v3.2';

  // Start container
  const startCmd = [
    runtimePath,
    'run',
    '-d',
    '--rm',
    '-p',
    '8080',
    '-v',
    `${TEST_DYNAMIC_CONFIG}:/etc/traefik/dynamic.yml:ro`,
    '--pull=missing',
    image,
    '--api.insecure=true',
    '--providers.file.filename=/etc/traefik/dynamic.yml',
    '--entrypoints.web.address=:80',
    '--entrypoints.websecure.address=:443',
    '--entrypoints.tcp.address=:2222',
    '--log.level=DEBUG',
  ];
  const startResult = Bun.spawnSync({
    cmd: startCmd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (startResult.exitCode !== 0) {
    const stderr = new TextDecoder().decode(startResult.stderr);
    throw new Error(`Failed to start Traefik container: ${stderr}`);
  }

  const containerId = new TextDecoder().decode(startResult.stdout).trim();

  // Get mapped port
  const portResult = Bun.spawnSync({
    cmd: [runtimePath, 'port', containerId, '8080'],
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (portResult.exitCode !== 0) {
    const stderr = new TextDecoder().decode(portResult.stderr);
    console.error(`Failed to get port: ${stderr}`);
    stopTraefikContainer(containerId);
    throw new Error(`Failed to get mapped port for container ${containerId}`);
  }

  const portOutput = new TextDecoder().decode(portResult.stdout).trim();
  // Format: "0.0.0.0:XXXXX" or "[::]:XXXXX"
  const port = portOutput.split(':').pop();
  if (!port) {
    stopTraefikContainer(containerId);
    throw new Error(`Unexpected port output format: ${portOutput}`);
  }

  const apiUrl = `http://localhost:${port}`;

  // Wait for Traefik to be ready
  const maxRetries = 30;
  let lastStatus = 0;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${apiUrl}/api/version`);
      lastStatus = response.status;
      if (response.status === 200) {
        return { apiUrl, containerId };
      }
    } catch {
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  stopTraefikContainer(containerId);
  throw new Error(`Traefik container failed to become ready. Last status: ${lastStatus}`);
}

export function stopTraefikContainer(containerId: string): void {
  detectContainerRuntime(); // ensures _runtimePath is set
  const runtimePath = _runtimePath!;

  try {
    Bun.spawnSync({
      cmd: [runtimePath, 'stop', '-t', '5', containerId],
      stdout: 'pipe',
      stderr: 'pipe',
    });
  } catch {
    // Swallow error
  }

  try {
    Bun.spawnSync({
      cmd: [runtimePath, 'rm', '-f', containerId],
      stdout: 'pipe',
      stderr: 'pipe',
    });
  } catch {
    // Swallow error
  }
}

// ---- Dynamic app import (after env and container are set up) ----

let _app: any = null;

export async function getApp() {
  if (!_app) {
    const mod = await import('../src/app');
    _app = mod.app;
  }
  return _app;
}

// ---- Test user management ----

import { getDb, resetDb } from '../src/db';
import { generateToken } from '../src/auth/middleware';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
  token: '',
  userId: 0,
};

export async function setupTestUser(): Promise<void> {
  resetDb();
  const db = getDb();

  db.run('DELETE FROM users');

  const passwordHash = await Bun.password.hash(TEST_USER.password, {
    algorithm: 'argon2id',
    timeCost: 1,
    memoryCost: 4096,
  });
  const result = db.run('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)', [
    TEST_USER.username,
    passwordHash,
  ]);
  TEST_USER.userId = Number(result.lastInsertRowid || 1);
  TEST_USER.token = generateToken(TEST_USER.userId, TEST_USER.username);
}

export function getTestToken(): string {
  return TEST_USER.token;
}

export function getTestUsername(): string {
  return TEST_USER.username;
}

// ---- Request helpers ----

export function createRequest(path: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
  });
}

export function authRequest(path: string, token: string, options: RequestInit = {}): Request {
  return createRequest(path, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
