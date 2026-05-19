const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

interface EncryptedSecretPayload {
  v: 1;
  alg: "AES-GCM";
  iv: string;
  data: string;
}

export async function encryptSecret(secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getCredentialKey();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(secret),
  );

  const payload: EncryptedSecretPayload = {
    v: 1,
    alg: "AES-GCM",
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };

  return JSON.stringify(payload);
}

export async function decryptSecret(storedSecret: string): Promise<string> {
  const value = storedSecret.trim();
  if (!value) return "";

  if (!value.startsWith("{")) {
    return atob(value);
  }

  const payload = JSON.parse(value) as EncryptedSecretPayload;
  if (payload.v !== 1 || payload.alg !== "AES-GCM" || !payload.iv || !payload.data) {
    throw new Error("Unsupported WordPress credential format");
  }

  const key = await getCredentialKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.data),
  );

  return textDecoder.decode(decrypted);
}

export function encodeBasicAuth(username: string, password: string): string {
  return bytesToBase64(textEncoder.encode(`${username}:${password}`));
}

async function getCredentialKey(): Promise<CryptoKey> {
  const rawSecret = Deno.env.get("WORDPRESS_CREDENTIALS_KEY");
  if (!rawSecret || rawSecret.length < 24) {
    throw new Error("WORDPRESS_CREDENTIALS_KEY must be set to at least 24 characters");
  }

  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(rawSecret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
