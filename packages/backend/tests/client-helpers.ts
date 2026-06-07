// Helper for client tests - sets up mock Traefik env without importing the app

import './env';
import { startMockTraefik, stopMockTraefik, getMockTraefikUrl } from './mock-traefik';

startMockTraefik();
const MOCK_TRAEFIK_URL = getMockTraefikUrl();

// Override the env BEFORE config is imported
process.env.TRAEFIK_API_URL = MOCK_TRAEFIK_URL;

export { stopMockTraefik, MOCK_TRAEFIK_URL };

// Re-export cleanup from original helpers (db cleanup still needed)
import { closeDb } from '../src/db';

export function cleanupTestEnv(): void {
  closeDb();
}
