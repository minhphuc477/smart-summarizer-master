import { encryptText, decryptText, hashPassword, validatePasswordStrength } from '../encryption';

describe('Encryption Module', () => {
  test('encrypts and decrypts text', () => {
    const text = 'Secret message';
    const password = 'MyP@ssw0rd123';
    const encrypted = encryptText(text, password);
    expect(encrypted.encrypted).toBeDefined();
    const decrypted = decryptText(encrypted.encrypted, password, encrypted.iv, encrypted.salt);
    expect(decrypted).toBe(text);
  });

  test('different encryptions produce different results', () => {
    const enc1 = encryptText('test', 'pass');
    const enc2 = encryptText('test', 'pass');
    expect(enc1.encrypted).not.toBe(enc2.encrypted);
  });

  test('hashes password consistently', () => {
    const hash1 = hashPassword('password');
    const hash2 = hashPassword('password');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  test('validates strong password', () => {
    const result = validatePasswordStrength('MyP@ssw0rd123!');
    expect(result.valid).toBe(true);
    expect(result.strength).toBe('strong');
  });

  test('rejects weak password', () => {
    const result = validatePasswordStrength('weak');
    expect(result.valid).toBe(false);
  });
});
