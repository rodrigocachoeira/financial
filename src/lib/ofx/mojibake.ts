const WINDOWS_1252 = new TextDecoder("windows-1252");
const UTF8_STRICT = new TextDecoder("utf-8", { fatal: true });

/** Character -> byte, for every byte of windows-1252 as the decoder above reads it. */
const BYTE_OF = new Map<string, number>(
  Array.from({ length: 256 }, (_, byte) => [WINDOWS_1252.decode(Uint8Array.of(byte)), byte]),
);

/**
 * Undoes UTF-8 text that was read as windows-1252 ("crÃ©dito" -> "crédito").
 * Text that is not such a misreading comes back unchanged, so this is safe to apply to anything.
 */
export function repairMojibake(text: string): string {
  const bytes = new Uint8Array(text.length);
  let nonAscii = false;
  for (let index = 0; index < text.length; index += 1) {
    const byte = BYTE_OF.get(text[index]);
    if (byte === undefined) {
      return text;
    }
    bytes[index] = byte;
    nonAscii ||= byte > 0x7f;
  }
  if (!nonAscii) {
    return text;
  }
  try {
    return UTF8_STRICT.decode(bytes);
  } catch {
    return text;
  }
}
