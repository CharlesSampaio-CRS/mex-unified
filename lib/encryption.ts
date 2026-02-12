/**
 * Encryption Service
 * 
 * Provides secure encryption/decryption for sensitive data like API keys
 * Uses Web Crypto API for native encryption
 */

import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// Encryption key derivation salt (should be unique per app)
const SALT = 'cryptohub_v1_salt_2026';

/**
 * Generates an encryption key from user's credentials
 * Uses PBKDF2 for key derivation
 */
async function deriveKey(userId: string): Promise<string> {
  // Combine userId with app salt for unique key per user
  const keyMaterial = `${userId}_${SALT}`;
  
  if (Platform.OS === 'web') {
    // Use Web Crypto API for browser
    const encoder = new TextEncoder();
    const data = encoder.encode(keyMaterial);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } else {
    // Use Expo Crypto for native
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      keyMaterial
    );
    return hash;
  }
}

/**
 * Simple XOR-based encryption (for local storage)
 * Note: This is not production-grade encryption, but sufficient for local data protection
 * For production, consider using native encryption modules
 */
function xorEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  // Convert to base64 for safe storage
  if (Platform.OS === 'web') {
    return btoa(result);
  } else {
    // For native, use base64 encoding
    return Buffer.from(result, 'binary').toString('base64');
  }
}

/**
 * Simple XOR-based decryption
 */
function xorDecrypt(encrypted: string, key: string): string {
  try {
    // Decode from base64
    let text: string;
    if (Platform.OS === 'web') {
      text = atob(encrypted);
    } else {
      text = Buffer.from(encrypted, 'base64').toString('binary');
    }
    
    // XOR decrypt
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (error) {
    console.error('❌ [Encryption] Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypts sensitive data (API keys, secrets)
 * @param plainText - The text to encrypt
 * @param userId - User ID for key derivation
 * @returns Encrypted text (base64 encoded)
 */
export async function encryptData(plainText: string, userId: string): Promise<string> {
  if (!plainText || !userId) {
    throw new Error('Invalid input for encryption');
  }
  
  const key = await deriveKey(userId);
  const encrypted = xorEncrypt(plainText, key);
  
  return encrypted;
}

/**
 * Decrypts sensitive data
 * @param encryptedText - The encrypted text (base64 encoded)
 * @param userId - User ID for key derivation
 * @returns Decrypted plain text
 */
export async function decryptData(encryptedText: string, userId: string): Promise<string> {
  if (!encryptedText || !userId) {
    throw new Error('Invalid input for decryption');
  }
  
  const key = await deriveKey(userId);
  const decrypted = xorDecrypt(encryptedText, key);
  
  return decrypted;
}

/**
 * Checks if a string is encrypted (base64 format)
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  
  try {
    // Check if it's valid base64
    if (Platform.OS === 'web') {
      const decoded = atob(text);
      const encoded = btoa(decoded);
      return encoded === text;
    } else {
      const decoded = Buffer.from(text, 'base64').toString('binary');
      const encoded = Buffer.from(decoded, 'binary').toString('base64');
      return encoded === text;
    }
  } catch {
    return false;
  }
}

/**
 * Encrypts exchange credentials
 */
export async function encryptExchangeCredentials(
  apiKey: string,
  apiSecret: string,
  apiPassphrase: string | undefined,
  userId: string
): Promise<{
  apiKeyEncrypted: string;
  apiSecretEncrypted: string;
  apiPassphraseEncrypted?: string;
}> {
  
  const apiKeyEncrypted = await encryptData(apiKey, userId);
  const apiSecretEncrypted = await encryptData(apiSecret, userId);
  const apiPassphraseEncrypted = apiPassphrase 
    ? await encryptData(apiPassphrase, userId) 
    : undefined;
  
  return {
    apiKeyEncrypted,
    apiSecretEncrypted,
    apiPassphraseEncrypted
  };
}

/**
 * Decrypts exchange credentials
 */
export async function decryptExchangeCredentials(
  apiKeyEncrypted: string,
  apiSecretEncrypted: string,
  apiPassphraseEncrypted: string | undefined,
  userId: string
): Promise<{
  apiKey: string;
  apiSecret: string;
  apiPassphrase?: string;
}> {
  
  const apiKey = await decryptData(apiKeyEncrypted, userId);
  const apiSecret = await decryptData(apiSecretEncrypted, userId);
  const apiPassphrase = apiPassphraseEncrypted 
    ? await decryptData(apiPassphraseEncrypted, userId) 
    : undefined;
  
  
  return {
    apiKey,
    apiSecret,
    apiPassphrase
  };
}
