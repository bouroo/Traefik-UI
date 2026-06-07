import { config } from '../config';

const ENCODER = new TextEncoder();

async function getKey(): Promise<CryptoKey> {
  const keyBuffer = await crypto.subtle.digest(
    'SHA-256',
    ENCODER.encode(config.auth.encryptionKey)
  );
  return crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    ENCODER.encode(plaintext)
  );
  const ivB64 = Buffer.from(iv).toString('base64');
  const ctB64 = Buffer.from(new Uint8Array(ciphertext)).toString('base64');
  return `${ivB64}:${ctB64}`;
}

export async function decryptSecret(ciphertext: string): Promise<string> {
  const [ivB64, ctB64] = ciphertext.split(':');
  if (!ivB64 || !ctB64) throw new Error('Invalid encrypted secret format');
  const key = await getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const data = Buffer.from(ctB64, 'base64');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plaintext);
}
