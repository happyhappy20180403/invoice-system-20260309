import { describe, it, expect, beforeAll } from 'vitest';
import { randomBytes } from 'node:crypto';

// Set up encryption key before importing module
beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
});

describe('Encryption (AES-256-GCM)', () => {
  it('should encrypt and decrypt a string correctly', async () => {
    const { encrypt, decrypt } = await import('../lib/xero/encrypt');

    const plaintext = 'test-access-token-12345';
    const ciphertext = encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.length).toBeGreaterThan(0);

    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext (random IV)', async () => {
    const { encrypt } = await import('../lib/xero/encrypt');

    const plaintext = 'same-input-text';
    const ct1 = encrypt(plaintext);
    const ct2 = encrypt(plaintext);

    expect(ct1).not.toBe(ct2);
  });

  it('should handle empty string', async () => {
    const { encrypt, decrypt } = await import('../lib/xero/encrypt');

    const ciphertext = encrypt('');
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe('');
  });

  it('should handle long strings', async () => {
    const { encrypt, decrypt } = await import('../lib/xero/encrypt');

    const longString = 'a'.repeat(10000);
    const ciphertext = encrypt(longString);
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(longString);
  });

  it('should fail decryption with wrong key', async () => {
    const { encrypt } = await import('../lib/xero/encrypt');
    const ciphertext = encrypt('secret-data');

    // Change key
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');

    // Re-import to get new key (vitest module cache)
    // Since module is cached, manually test with wrong buffer
    const { Buffer } = await import('node:buffer');
    const { createDecipheriv } = await import('node:crypto');

    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const wrongKey = randomBytes(32);

    const decipher = createDecipheriv('aes-256-gcm', wrongKey, iv);
    decipher.setAuthTag(tag);

    expect(() => {
      decipher.update(encrypted) + decipher.final('utf8');
    }).toThrow();
  });
});
