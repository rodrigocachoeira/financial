export const MAX_FILE_BYTES = 1_000_000;
export const MAX_FILES = 12;

export type UploadError = "EMPTY" | "TOO_LARGE" | "WRONG_EXTENSION";

const OFX_FILE_NAME = /.\.ofx$/i;

/** Checks what can be known before reading the content; the statement reader validates the rest. */
export function validateUpload(file: { name: string; size: number }): UploadError | null {
  if (!OFX_FILE_NAME.test(file.name)) {
    return "WRONG_EXTENSION";
  }
  if (file.size === 0) {
    return "EMPTY";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "TOO_LARGE";
  }
  return null;
}

const MESSAGES: Record<UploadError, string> = {
  EMPTY: "O arquivo está vazio.",
  TOO_LARGE: "O arquivo passa do limite de 1 MB.",
  WRONG_EXTENSION: "Apenas arquivos .ofx são aceitos.",
};

export function uploadErrorMessage(error: UploadError): string {
  return MESSAGES[error];
}
