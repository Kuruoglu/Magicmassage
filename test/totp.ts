import { createHmac } from "node:crypto";

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(value: string) {
  const bits = value
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "")
    .split("")
    .map((character) => {
      const index = base32Alphabet.indexOf(character);

      if (index < 0) {
        throw new Error("The configured TOTP secret is not valid base32.");
      }

      return index.toString(2).padStart(5, "0");
    })
    .join("");
  const bytes: number[] = [];

  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }

  return Buffer.from(bytes);
}
export function createTotpCode(secret: string, timestamp = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30_000)));

  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode =
    (digest[offset] & 0x7f) * 0x1000000 +
    digest[offset + 1] * 0x10000 +
    digest[offset + 2] * 0x100 +
    digest[offset + 3];

  return String(binaryCode % 1_000_000).padStart(6, "0");
}
