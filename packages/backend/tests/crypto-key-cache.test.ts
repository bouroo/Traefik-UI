import { describe, it, expect, beforeEach } from 'bun:test';
import { encryptSecret, decryptSecret, _resetCryptoKeyCache } from '../src/lib/crypto';

describe('crypto key caching', () => {
  beforeEach(() => {
    _resetCryptoKeyCache();
  });

  it('round-trips after the cache change', async () => {
    const original = 'cache-aware round trip 🗝️';
    const ct = await encryptSecret(original);
    const pt = await decryptSecret(ct);
    expect(pt).toBe(original);
  });

  it('derives the key once for sequential encrypt calls', async () => {
    let importKeyCount = 0;
    const originalImportKey = crypto.subtle.importKey.bind(crypto.subtle);
    // @ts-expect-error monkey-patching for test instrumentation
    crypto.subtle.importKey = async (...args: unknown[]) => {
      importKeyCount += 1;
      // @ts-expect-error spread args into the original implementation
      return originalImportKey(...args);
    };

    try {
      await encryptSecret('first');
      await encryptSecret('second');
      const ct = await encryptSecret('third');
      await decryptSecret(ct);

      expect(importKeyCount).toBe(1);
    } finally {
      crypto.subtle.importKey = originalImportKey;
    }
  });

  it('re-derives after reset', async () => {
    let importKeyCount = 0;
    const originalImportKey = crypto.subtle.importKey.bind(crypto.subtle);
    // @ts-expect-error monkey-patching for test instrumentation
    crypto.subtle.importKey = async (...args: unknown[]) => {
      importKeyCount += 1;
      // @ts-expect-error spread args into the original implementation
      return originalImportKey(...args);
    };

    try {
      await encryptSecret('before reset');
      expect(importKeyCount).toBe(1);

      _resetCryptoKeyCache();
      await encryptSecret('after reset');
      expect(importKeyCount).toBe(2);
    } finally {
      crypto.subtle.importKey = originalImportKey;
    }
  });

  it('shares one derivation across concurrent first calls', async () => {
    let importKeyCount = 0;
    const originalImportKey = crypto.subtle.importKey.bind(crypto.subtle);
    // @ts-expect-error monkey-patching for test instrumentation
    crypto.subtle.importKey = async (...args: unknown[]) => {
      importKeyCount += 1;
      // @ts-expect-error spread args into the original implementation
      return originalImportKey(...args);
    };

    try {
      await Promise.all([encryptSecret('concurrent-a'), encryptSecret('concurrent-b')]);

      expect(importKeyCount).toBe(1);
    } finally {
      crypto.subtle.importKey = originalImportKey;
    }
  });
});
