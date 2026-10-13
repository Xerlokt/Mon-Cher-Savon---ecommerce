import { randomInt } from 'node:crypto';

// No 0/O/1/I/L to avoid confusion when the customer reads the code aloud.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Random, non-sequential order code such as "A7K2QX". */
export function generatePublicCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
