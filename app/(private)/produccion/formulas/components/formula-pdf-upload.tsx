'use client';

import { DocumentBatchPanel, DocumentUploadDialog } from '@/components/shared/document-upload';
import { formulaImportRoute } from '@/lib/shared/routes';

/**
 * Envuelve la pieza compartida de subida con la estrategia de formula y la ruta de revision de
 * cada archivo, y anade el panel de tandas recordadas fuera de la ventana. Existe porque una
 * funcion no puede cruzar del Server Component (`page.tsx`) al cliente: alguien tiene que pasar
 * `reviewHrefFor` al cliente.
 */
export type FormulaPdfUploadProps = {
  readonly disabled?: boolean;
};

export function FormulaPdfUpload({ disabled }: FormulaPdfUploadProps) {
  return (
    <>
      <DocumentUploadDialog
        strategy="formula"
        reviewHrefFor={formulaImportRoute}
        disabled={disabled}
      />
      <DocumentBatchPanel
        strategy="formula"
        reviewHrefFor={formulaImportRoute}
        disabled={disabled}
      />
    </>
  );
}