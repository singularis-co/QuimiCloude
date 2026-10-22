import type { ImportTemplateSheet } from '../domain/inventory-import-downloads';

export interface SpreadsheetWriter {
  /** Un .xlsx con las hojas en el orden dado. */
  write(sheets: readonly ImportTemplateSheet[]): Promise<Uint8Array>;
}
