import { createHash } from "node:crypto";
import { uploadErrorMessage, validateUpload } from "@/lib/imports/validate-upload";
import { decodeOfx, OfxParseError, parseNubankOfx, type ParsedStatement, type Source } from "@/lib/ofx";
import type { PrismaClient } from "../prisma";
import { importStatement } from "./import-statement";

export interface ImportFileResult {
  fileName: string;
  status: "IMPORTED" | "ALREADY_IMPORTED" | "REJECTED";
  source?: Source;
  periodStart?: string;
  periodEnd?: string;
  transactionCount?: number;
  newTransactionCount?: number;
  /** Only for REJECTED. Never contains transaction descriptions. */
  reason?: string;
}

/** Validates, decodes, parses, hashes and stores one uploaded file. Never throws for an invalid file. */
export async function importFile(
  db: PrismaClient,
  file: { name: string; bytes: Uint8Array },
): Promise<ImportFileResult> {
  const rejected = (reason: string): ImportFileResult => ({ fileName: file.name, status: "REJECTED", reason });

  const uploadError = validateUpload({ name: file.name, size: file.bytes.byteLength });
  if (uploadError) {
    return rejected(uploadErrorMessage(uploadError));
  }

  let statement: ParsedStatement;
  try {
    statement = parseNubankOfx(decodeOfx(file.bytes));
  } catch (error) {
    if (error instanceof OfxParseError) {
      // OfxParseError messages name the tag and position only, never the content.
      return rejected(`O arquivo não é um OFX válido do Nubank (${error.message}).`);
    }
    throw error;
  }

  const fileHash = createHash("sha256").update(file.bytes).digest("hex");
  const result = await importStatement(db, { statement, fileName: file.name, fileHash });

  return {
    fileName: file.name,
    status: result.alreadyImported ? "ALREADY_IMPORTED" : "IMPORTED",
    source: statement.source,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    transactionCount: result.transactionCount,
    newTransactionCount: result.newTransactionCount,
  };
}
