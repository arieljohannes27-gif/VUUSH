const MAX_DOC = 1_200_000;
const MAX_PHOTO = 900_000;

export function isImageDataUrl(value: string): boolean {
  return value.startsWith("data:image/");
}

export function isPdfOrImageDataUrl(value: string): boolean {
  return (
    value.startsWith("data:image/") ||
    value.startsWith("data:application/pdf")
  );
}

export function assertPhotoDataUrl(
  value: string | undefined,
  code: string,
): string | { ok: false; error: string } {
  if (!value || !isImageDataUrl(value)) {
    return { ok: false, error: code };
  }
  if (value.length > MAX_PHOTO) {
    return { ok: false, error: `${code}_too_large` };
  }
  return value;
}

export function assertPdfOrImageDataUrl(
  value: string | undefined,
  code: string,
): string | { ok: false; error: string } {
  if (!value || !isPdfOrImageDataUrl(value)) {
    return { ok: false, error: code };
  }
  if (value.length > MAX_DOC) {
    return { ok: false, error: `${code}_too_large` };
  }
  return value;
}
