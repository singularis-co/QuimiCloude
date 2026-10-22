// Safari inicia la descarga de forma asíncrona: revocar la URL en el acto puede cortarla.
const REVOKE_DELAY_MS = 40_000;

export type DownloadableFile = {
  readonly fileName: string;
  readonly mimeType: string;
  readonly content: BlobPart;
};

export function downloadFile(download: DownloadableFile): void {
  const blob = new Blob([download.content], { type: download.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = download.fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

export function base64Bytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
