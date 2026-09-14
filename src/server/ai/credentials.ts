import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AiError } from './errors';
export type Keyring = { activeVersion: string; keys: Record<string, string> };
export type Credential = { version: string; iv: string; tag: string; data: string };
export type CredentialTarget = { id: string; endpoint: string; protocol: string };
export function environmentKeyring(): Keyring {
  try {
    return { activeVersion: process.env.AI_CREDENTIAL_ACTIVE_VERSION ?? '', keys: JSON.parse(process.env.AI_CREDENTIAL_KEYS ?? '') };
  } catch { throw new AiError('credential_unavailable'); }
}
function key(ring: Keyring, version: string): Buffer {
  const encoded = ring.keys?.[version];
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(version) || typeof encoded !== 'string') throw new AiError('credential_unavailable');
  const value = Buffer.from(encoded, 'base64');
  if (value.length !== 32 || value.toString('base64') !== encoded) throw new AiError('credential_unavailable');
  return value;
}
function aad(target: CredentialTarget): Buffer {
  return Buffer.from(JSON.stringify(['sleepy-ai-credential', target.id, target.protocol, target.endpoint]));
}
export function encryptCredential(secret: string, target: CredentialTarget, ring: Keyring): Credential {
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(ring, ring.activeVersion), iv);
    cipher.setAAD(aad(target));
    const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return { version: ring.activeVersion, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  } catch { throw new AiError('credential_unavailable'); }
}
export function decryptCredential(credential: Credential, target: CredentialTarget, ring: Keyring): string {
  try {
    const iv = Buffer.from(credential.iv, 'base64');
    const tag = Buffer.from(credential.tag, 'base64');
    if (iv.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key(ring, credential.version), iv);
    decipher.setAAD(aad(target));
    decipher.setAuthTag(tag);
    const secret = Buffer.concat([decipher.update(Buffer.from(credential.data, 'base64')), decipher.final()]).toString('utf8');
    if (!secret) throw new Error();
    return secret;
  } catch { throw new AiError('credential_unavailable'); }
}
