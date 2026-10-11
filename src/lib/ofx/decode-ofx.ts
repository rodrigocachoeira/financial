const UTF8_STRICT = new TextDecoder("utf-8", { fatal: true });
const WINDOWS_1252 = new TextDecoder("windows-1252");

/**
 * Decodes OFX file bytes. The header is not trusted: Nubank's card statements declare
 * `ENCODING:USASCII` and `CHARSET:1252` while carrying UTF-8. Text with accents is practically
 * never valid UTF-8 by accident, so UTF-8 is tried first and windows-1252 is the fallback.
 */
export function decodeOfx(bytes: Uint8Array): string {
  try {
    return UTF8_STRICT.decode(bytes);
  } catch {
    return WINDOWS_1252.decode(bytes);
  }
}
