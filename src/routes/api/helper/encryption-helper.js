import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Get encryption key from environment variable
// If not set, generate a warning - this should be a 32-byte hex string
const ENCRYPTION_KEY = process.env.MESSAGE_ENCRYPTION_KEY;

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes authentication tag
const KEY_LENGTH = 32; // 32 bytes = 256 bits

/**
 * Derives a buffer key from the encryption key string
 */
function getKeyBuffer() {
	if (!ENCRYPTION_KEY) {
		throw new Error('Encryption key is not configured');
	}
	
	// If the key is a hex string, convert it to buffer
	if (ENCRYPTION_KEY.length === KEY_LENGTH * 2) {
		return Buffer.from(ENCRYPTION_KEY, 'hex');
	}
	
	// Otherwise, hash it to get a consistent 32-byte key
	return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

/**
 * Encrypts a text message using AES-256-GCM
 * @param {string} text - The plaintext message to encrypt
 * @returns {string} - The encrypted message in format: iv:authTag:encryptedData (all hex-encoded)
 */
export function encryptMessage(text) {
	try {
		if (!text || typeof text !== 'string') {
			throw new Error('Invalid text to encrypt');
		}

		const key = getKeyBuffer();
		const iv = crypto.randomBytes(IV_LENGTH);
		const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

		let encrypted = cipher.update(text, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		const authTag = cipher.getAuthTag();

		// Return format: iv:authTag:encryptedData
		return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
	} catch (error) {
		console.error('Encryption error:', error);
		throw new Error('Failed to encrypt message');
	}
}

/**
 * Decrypts an encrypted message
 * @param {string} encryptedText - The encrypted message in format: iv:authTag:encryptedData
 * @returns {string} - The decrypted plaintext message
 */
export function decryptMessage(encryptedText) {
	try {
		if (!encryptedText || typeof encryptedText !== 'string') {
			throw new Error('Invalid encrypted text');
		}

		// Check if the message is already in encrypted format (contains colons)
		if (!encryptedText.includes(':')) {
			// This might be a legacy unencrypted message
			// Return it as-is with a warning
			console.warn('Warning: Attempting to decrypt a message that appears to be unencrypted');
			return encryptedText;
		}

		const parts = encryptedText.split(':');
		if (parts.length !== 3) {
			throw new Error('Invalid encrypted message format');
		}

		const [ivHex, authTagHex, encryptedData] = parts;
		const key = getKeyBuffer();
		const iv = Buffer.from(ivHex, 'hex');
		const authTag = Buffer.from(authTagHex, 'hex');

		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		return decrypted;
	} catch (error) {
		console.error('Decryption error:', error);
		throw new Error('Failed to decrypt message');
	}
}

/**
 * Encrypts all messages in an array
 * @param {Array} messages - Array of message objects
 * @returns {Array} - Array with encrypted text fields
 */
export function encryptMessages(messages) {
	if (!Array.isArray(messages)) {
		return messages;
	}

	return messages.map(msg => ({
		...msg,
		text: encryptMessage(msg.text)
	}));
}

/**
 * Decrypts all messages in an array
 * @param {Array} messages - Array of message objects with encrypted text
 * @returns {Array} - Array with decrypted text fields
 */
export function decryptMessages(messages) {
	if (!Array.isArray(messages)) {
		return messages;
	}

	return messages.map(msg => {
		try {
			// Skip decryption for empty text (messages with only attachments)
			if (!msg.text || msg.text === '') {
				return {
					...msg,
					text: ''
				};
			}
			return {
				...msg,
				text: decryptMessage(msg.text)
			};
		} catch (error) {
			// If decryption fails, return the message as-is (might be legacy unencrypted)
			console.warn(`Failed to decrypt message ${msg.id}:`, error.message);
			return msg;
		}
	});
}

/**
 * Generates a new encryption key (for setup purposes)
 * @returns {string} - A 32-byte hex string suitable for use as encryption key
 */
export function generateEncryptionKey() {
	return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

