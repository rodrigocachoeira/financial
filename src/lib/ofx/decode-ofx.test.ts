import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeOfx, parseNubankOfx } from "./index";

const WINDOWS_1252_HEADER = "OFXHEADER:100\nENCODING:USASCII\nCHARSET:1252\n\n";

describe("decodeOfx", () => {
  it("decodes a UTF-8 file with accents", () => {
    const bytes = readFileSync("fixtures/nubank/account.ofx");
    const content = decodeOfx(bytes);
    expect(content).toContain("Transferência recebida pelo Pix");
    expect(parseNubankOfx(content).transactions).toHaveLength(5);
  });

  it("decodes a windows-1252 file with accents", () => {
    const bytes = Buffer.from(`${WINDOWS_1252_HEADER}<MEMO>Padaria São João – Café</MEMO>`, "latin1");
    // 0x96 is the en dash in windows-1252 and a control character in latin1.
    bytes[bytes.indexOf(0x13)] = 0x96;
    expect(decodeOfx(bytes)).toContain("Padaria São João – Café");
  });

  it("reads UTF-8 even when the header declares windows-1252, as Nubank card statements do", () => {
    const bytes = Buffer.from(`${WINDOWS_1252_HEADER}<MEMO>Ajuste a crédito</MEMO>`, "utf8");
    expect(decodeOfx(bytes)).toContain("<MEMO>Ajuste a crédito</MEMO>");
  });

  it("strips a UTF-8 byte order mark", () => {
    const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("OFXHEADER:100\nENCODING:UTF-8\n")]);
    expect(decodeOfx(bytes).startsWith("OFXHEADER")).toBe(true);
  });

  it("reads UTF-8 when the header declares no encoding", () => {
    expect(decodeOfx(Buffer.from("<MEMO>Café</MEMO>", "utf8"))).toBe("<MEMO>Café</MEMO>");
  });
});
