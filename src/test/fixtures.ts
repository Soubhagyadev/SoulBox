import {
  encryptFile,
  exportPrivateKeyPem,
  exportPublicKeyPem,
  generateKeyPair,
  importPublicKeyPem,
  stringToBytes,
  type SealBoxPackage,
} from '../lib/crypto'
import type { StoredKey } from '../lib/storage/keyVault'

export interface TestKeyMaterial {
  stored: StoredKey
  publicKeyPem: string
  privateKeyPem: string
}

export async function createTestKey(
  name = 'Test key',
  id = 'test-key-1',
): Promise<TestKeyMaterial> {
  const pair = await generateKeyPair()
  const [publicKeyPem, privateKeyPem] = await Promise.all([
    exportPublicKeyPem(pair.publicKey),
    exportPrivateKeyPem(pair.privateKey),
  ])
  return {
    publicKeyPem,
    privateKeyPem,
    stored: {
      id,
      name,
      createdAt: new Date().toISOString(),
      algorithm: 'RSA-OAEP-2048',
      publicKeyPem,
      privateKeyPem,
    },
  }
}

export async function createTestPackage(
  publicKeyPem: string,
  fileName: string,
  content: string,
): Promise<SealBoxPackage> {
  const publicKey = await importPublicKeyPem(publicKeyPem)
  return encryptFile({
    data: stringToBytes(content),
    fileName,
    fileType: 'text/plain',
    recipientPublicKey: publicKey,
  })
}
