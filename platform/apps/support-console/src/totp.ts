/** Minimal TOTP (RFC 6238) for local staff MFA in the console. */

function base32Decode(input: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = input.replace(/=+$/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter & 0xffffffff);
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export async function generateTotp(secretBase32: string): Promise<string> {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  return hotp(secret, counter);
}

export function totpStorageKey(email: string) {
  return `vuush.support.totp.${email.trim().toLowerCase()}`;
}

export function totpStorageKeyLegacy(email: string) {
  return `swift.support.totp.${email.trim().toLowerCase()}`;
}

export function readTotpSecret(email: string): string | null {
  const next = totpStorageKey(email);
  const legacy = totpStorageKeyLegacy(email);
  const value = localStorage.getItem(next) ?? localStorage.getItem(legacy);
  if (value && !localStorage.getItem(next)) {
    localStorage.setItem(next, value);
    localStorage.removeItem(legacy);
  }
  return value;
}

export function writeTotpSecret(email: string, secret: string) {
  localStorage.setItem(totpStorageKey(email), secret);
  localStorage.removeItem(totpStorageKeyLegacy(email));
}

export function clearTotpSecret(email: string) {
  localStorage.removeItem(totpStorageKey(email));
  localStorage.removeItem(totpStorageKeyLegacy(email));
}
