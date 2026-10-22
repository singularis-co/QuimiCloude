import writeXlsxFile from 'write-excel-file/node';

import type { ImportTemplateSheet } from '../../../domain/inventory-import-downloads';

const COLUMN_WIDTH = 22;

/** Todo como texto: la lectura interpreta numeros y fechas igual que si los hubiera tecleado. */
export async function writeXlsx(sheets: readonly ImportTemplateSheet[]): Promise<Uint8Array> {
  const buffer = await writeXlsxFile(
    sheets.map((sheet) => {
      const [header = [], ...rows] = sheet.rows;
      return {
        sheet: sheet.name,
        data: [
          header.map((value) => ({ value, fontWeight: 'bold' as const })),
          ...rows.map((row) => row.map((value) => (value === '' ? null : { value, type: String }))),
        ],
        columns: header.map(() => ({ width: COLUMN_WIDTH })),
        stickyRowsCount: 1,
      };
    }),
  ).toBuffer();
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
