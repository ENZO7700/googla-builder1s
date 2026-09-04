export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILES = 10;
export const ALLOWED_EXT = /\.(txt|md|json|csv|js|ts|tsx|jsx|py|html|css|xml|yml|yaml|log|pdf|png|jpg|jpeg|webp|gif|svg)$/i;

export interface AttachmentLike {
  name: string;
  size: number;
  type: string;
}

/** Mirrors client-side validation in workspace file uploads. */
export function validateAttachmentFile(file: AttachmentLike): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `Súbor "${file.name}" je príliš veľký (max 20 MB).`;
  }
  if (!ALLOWED_EXT.test(file.name) && !file.type.startsWith('text/') && !file.type.startsWith('image/')) {
    return `Súbor "${file.name}" má nepovolený typ.`;
  }
  return null;
}
