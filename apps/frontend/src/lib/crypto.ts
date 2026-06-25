// src/lib/crypto.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.HARDWARE_CREDENTIAL_KEY;

function getEncryptionKey(): Buffer {
  if (!KEY_HEX) {
    throw new Error("Missing HARDWARE_CREDENTIAL_KEY environment variable.");
  }
  // If the key is base64 encoded (like the one provided), decode it; otherwise assume hex/utf8
  return KEY_HEX.length === 44 ? Buffer.from(KEY_HEX, 'base64') : Buffer.from(KEY_HEX, 'hex');
}

export function encryptCredential(plaintext: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Append the auth tag to the encrypted string for storage simplicity
  return {
    encrypted: `${encrypted}:${authTag}`,
    iv: iv.toString('hex')
  };
}

export function decryptCredential(encryptedData: string, ivHex: string): string {
  const [ciphertext, authTagHex] = encryptedData.split(':');
  if (!ciphertext || !authTagHex) {
    throw new Error("Invalid encrypted credential storage format.");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}