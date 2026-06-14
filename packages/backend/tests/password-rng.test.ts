import { describe, it, expect } from 'bun:test';
import { generateRandomPassword } from '../src/db/schema';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

describe('generateRandomPassword', () => {
  it('returns a string of the default length 12', () => {
    const password = generateRandomPassword();
    expect(typeof password).toBe('string');
    expect(password.length).toBe(12);
  });

  it('returns a string of the requested length', () => {
    expect(generateRandomPassword(20).length).toBe(20);
    expect(generateRandomPassword(1).length).toBe(1);
    expect(generateRandomPassword(32).length).toBe(32);
  });

  it('uses only characters from the configured alphabet', () => {
    const password = generateRandomPassword(50);
    for (const char of password) {
      expect(ALPHABET).toContain(char);
    }
  });

  it('produces different outputs on separate calls', () => {
    const a = generateRandomPassword(16);
    const b = generateRandomPassword(16);
    expect(a).not.toBe(b);
  });

  it('does not exhibit gross modulo bias over many length-1 samples', () => {
    const samples = 4000;
    const counts = new Map<string, number>();
    for (let i = 0; i < samples; i++) {
      const char = generateRandomPassword(1);
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }

    // Chi-squared goodness-of-fit against uniform distribution.
    // With 59 symbols and 4000 samples, expected count per symbol is ~67.8.
    // A generous p-value threshold of 0.001 makes false positives extremely
    // rare in CI while still rejecting gross bias (e.g. only the first 20
    // symbols being emitted, or any meaningful modulo skew).
    const k = ALPHABET.length;
    const expected = samples / k;
    let chiSquared = 0;
    for (const char of ALPHABET) {
      const observed = counts.get(char) ?? 0;
      chiSquared += Math.pow(observed - expected, 2) / expected;
    }

    // Degrees of freedom = k - 1. Critical values for chi-squared(58):
    // p = 0.001 => ~91.8. Any statistic below this is consistent with
    // uniformity at the 0.1% significance level.
    expect(chiSquared).toBeLessThan(92);

    // Every alphabet character should also have been observed at least once
    // across 4000 samples (probability of a miss for a single char is
    // astronomically small).
    expect(counts.size).toBe(ALPHABET.length);
  });
});
