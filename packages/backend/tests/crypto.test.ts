import { describe, it, expect } from 'bun:test';
import { encryptSecret, decryptSecret } from '../src/lib/crypto';

describe('crypto', () => {
  describe('encryptSecret + decryptSecret round-trip', () => {
    it('round-trips a short plaintext', async () => {
      const ct = await encryptSecret('hello world');
      const pt = await decryptSecret(ct);
      expect(pt).toBe('hello world');
    });

    it('round-trips a long plaintext', async () => {
      const long = 'a'.repeat(2048);
      const ct = await encryptSecret(long);
      const pt = await decryptSecret(ct);
      expect(pt).toBe(long);
    });

    it('round-trips a unicode plaintext', async () => {
      const ct = await encryptSecret('héllo 世界 🔐');
      const pt = await decryptSecret(ct);
      expect(pt).toBe('héllo 世界 🔐');
    });
  });

  describe('IV randomness', () => {
    it('two different plaintexts produce different ciphertexts', async () => {
      const a = await encryptSecret('alpha');
      const b = await encryptSecret('beta');
      expect(a).not.toBe(b);
    });

    it('same plaintext twice produces different ciphertexts (IV randomness)', async () => {
      const a = await encryptSecret('identical');
      const b = await encryptSecret('identical');
      expect(a).not.toBe(b);
    });
  });

  describe('ciphertext format', () => {
    it('uses ivBase64:ctBase64 colon-separated format', async () => {
      const ct = await encryptSecret('format-check');
      const parts = ct.split(':');
      expect(parts.length).toBe(2);

      const ivB64 = parts[0];
      const ctB64 = parts[1];
      expect(ivB64.length).toBeGreaterThan(0);
      expect(ctB64.length).toBeGreaterThan(0);

      const ivBytes = Buffer.from(ivB64, 'base64');
      expect(ivBytes.length).toBe(12);
    });
  });

  describe('decryptSecret error handling', () => {
    it('throws on input with no colon', () => {
      expect(() => decryptSecret('garbage')).toThrow();
    });

    it('throws on empty string', () => {
      expect(() => decryptSecret('')).toThrow();
    });

    it('throws on colon with empty iv', () => {
      expect(() => decryptSecret(':abc')).toThrow();
    });

    it('throws on colon with empty ciphertext', () => {
      expect(() => decryptSecret('abc:')).toThrow();
    });
  });
});
