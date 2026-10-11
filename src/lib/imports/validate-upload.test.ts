import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, uploadErrorMessage, validateUpload } from "./validate-upload";

describe("validateUpload", () => {
  it.each(["extrato.ofx", "EXTRATO.OFX", "Nubank_2026-11-17.ofx", "a.b.ofx"])("accepts %s", (name) => {
    expect(validateUpload({ name, size: 100 })).toBeNull();
  });

  it("accepts a file at the size limit", () => {
    expect(validateUpload({ name: "a.ofx", size: MAX_FILE_BYTES })).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(validateUpload({ name: "a.ofx", size: 0 })).toBe("EMPTY");
  });

  it("rejects a file above the size limit", () => {
    expect(validateUpload({ name: "a.ofx", size: MAX_FILE_BYTES + 1 })).toBe("TOO_LARGE");
  });

  it.each(["extrato.csv", "extrato.txt", "extrato", "ofx", "extrato.ofx.pdf", ".ofx"])(
    "rejects the extension of %s",
    (name) => {
      expect(validateUpload({ name, size: 100 })).toBe("WRONG_EXTENSION");
    },
  );

  it("has a message for every error", () => {
    for (const error of ["EMPTY", "TOO_LARGE", "WRONG_EXTENSION"] as const) {
      expect(uploadErrorMessage(error)).not.toBe("");
    }
  });
});
