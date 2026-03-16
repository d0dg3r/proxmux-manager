const EXPORT_VERSION = 1;
const KDF_NAME = 'PBKDF2';
const CIPHER_NAME = 'AES-GCM';
const HASH_NAME = 'SHA-256';
const DERIVED_KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 310000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

async function deriveAesKey(password, salt, iterations) {
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(password),
        { name: KDF_NAME },
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: KDF_NAME,
            salt,
            iterations,
            hash: HASH_NAME
        },
        passwordKey,
        { name: CIPHER_NAME, length: DERIVED_KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptSettingsPayload(payload, password) {
    const trimmedPassword = (password || '').trim();
    if (!trimmedPassword) {
        throw new Error('Password is required for export.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveAesKey(trimmedPassword, salt, PBKDF2_ITERATIONS);
    const plaintext = textEncoder.encode(JSON.stringify(payload));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: CIPHER_NAME, iv },
        key,
        plaintext
    ));

    return {
        version: EXPORT_VERSION,
        kdf: KDF_NAME,
        hash: HASH_NAME,
        cipher: CIPHER_NAME,
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(ciphertext),
        createdAt: new Date().toISOString()
    };
}

export async function decryptSettingsPayload(exportBlob, password) {
    const trimmedPassword = (password || '').trim();
    if (!trimmedPassword) {
        throw new Error('Password is required for import.');
    }
    if (!exportBlob || typeof exportBlob !== 'object') {
        throw new Error('Invalid backup format.');
    }
    if (exportBlob.version !== EXPORT_VERSION) {
        throw new Error('Unsupported backup version.');
    }
    if (exportBlob.kdf !== KDF_NAME || exportBlob.cipher !== CIPHER_NAME || exportBlob.hash !== HASH_NAME) {
        throw new Error('Unsupported backup encryption.');
    }

    const iterations = Number(exportBlob.iterations || 0);
    if (!Number.isFinite(iterations) || iterations < 100000) {
        throw new Error('Invalid backup KDF parameters.');
    }

    let decrypted;
    try {
        const salt = base64ToBytes(exportBlob.salt || '');
        const iv = base64ToBytes(exportBlob.iv || '');
        const ciphertext = base64ToBytes(exportBlob.ciphertext || '');
        const key = await deriveAesKey(trimmedPassword, salt, iterations);
        decrypted = await crypto.subtle.decrypt(
            { name: CIPHER_NAME, iv },
            key,
            ciphertext
        );
    } catch (_error) {
        throw new Error('Could not decrypt backup. Check password or file.');
    }

    try {
        return JSON.parse(textDecoder.decode(decrypted));
    } catch (_error) {
        throw new Error('Backup payload is not valid JSON.');
    }
}
