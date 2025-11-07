import CryptoJS from 'crypto-js';

// Encrypt text with password
export function encryptText(text: string, password: string): {
  encrypted: string;
  iv: string;
  salt: string;
} {
  // Generate salt
  const salt = CryptoJS.lib.WordArray.random(128/8).toString();
  
  // Derive key from password
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256/32,
    iterations: 1000
  });
  
  // Generate IV
  const iv = CryptoJS.lib.WordArray.random(128/8);
  
  // Encrypt
  const encrypted = CryptoJS.AES.encrypt(text, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return {
    encrypted: encrypted.toString(),
    iv: iv.toString(),
    salt: salt
  };
}

// Decrypt text with password
export function decryptText(
  encryptedText: string,
  password: string,
  iv: string,
  salt: string
): string {
  try {
    // Derive key from password with same salt
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256/32,
      iterations: 1000
    });
    
    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(encryptedText, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new Error('Decryption failed. Wrong password or corrupted data.');
  }
}

// Hash password for storage
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password).toString();
}

// Validate password strength
export function validatePasswordStrength(password: string): {
  valid: boolean;
  message: string;
  strength: 'weak' | 'medium' | 'strong';
} {
  if (password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters',
      strength: 'weak'
    };
  }
  
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  let score = 0;
  
  // Check various criteria
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score >= 4) strength = 'strong';
  else if (score >= 2) strength = 'medium';
  
  return {
    valid: score >= 2,
    message: strength === 'strong' 
      ? 'Strong password' 
      : strength === 'medium'
      ? 'Medium strength - consider adding more variety'
      : 'Weak password - add uppercase, numbers, and symbols',
    strength
  };
}

// Generate random encryption key
export function generateEncryptionKey(): string {
  return CryptoJS.lib.WordArray.random(256/8).toString();
}

// Encrypt object (for storing structured data)
export function encryptObject(obj: unknown, password: string): {
  encrypted: string;
  iv: string;
  salt: string;
} {
  const jsonString = JSON.stringify(obj);
  return encryptText(jsonString, password);
}

// Decrypt object
export function decryptObject<T = unknown>(
  encryptedText: string,
  password: string,
  iv: string,
  salt: string
): T {
  const decrypted = decryptText(encryptedText, password, iv, salt);
  return JSON.parse(decrypted) as T;
}

// Client-side encryption utilities
export const encryption = {
  encrypt: encryptText,
  decrypt: decryptText,
  encryptObject,
  decryptObject,
  hash: hashPassword,
  validatePassword: validatePasswordStrength,
  generateKey: generateEncryptionKey,
};

export default encryption;
