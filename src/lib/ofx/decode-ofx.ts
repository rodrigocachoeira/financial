const HEADER_BYTES = 512;

/** Decodes OFX file bytes according to its header (UTF-8 or windows-1252). */
export function decodeOfx(bytes: Uint8Array): string {
  const header = new TextDecoder("latin1").decode(bytes.subarray(0, HEADER_BYTES));
  const isUtf8 = /^ENCODING:\s*(?:UTF-8|UNICODE)\s*$/m.test(header);
  const isWindows1252 = /^CHARSET:\s*1252\s*$/m.test(header);
  const encoding = !isUtf8 && isWindows1252 ? "windows-1252" : "utf-8";
  return new TextDecoder(encoding).decode(bytes);
}
