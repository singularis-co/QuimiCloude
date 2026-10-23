'use client';

import { DocumentBatchPanel, DocumentUploadDialog } from '@/components/shared/document-upload';
import { formulaImportRoute } from '@/lib/shared/routes';

/**
 * Existen porque una funcion no puede cruzar del Server Component (`page.tsx`) al cliente: alguien
 * tiene que pasar `reviewHrefFor` al cliente.
 */
export type FormulaPdfUploadProps = {
  readonly disabled?: boolean;
  readonly registryScope?: string;
};

export function FormulaPdfUpload({ disabled, registryScope }: FormulaPdfUploadProps) {
  return (
    <DocumentUploadDialog
      strategy="formula"
      reviewHrefFor={formulaImportRoute}
      registryScope={registryScope}
      disabled={disabled}
    />
  );
}

export type FormulaBatchPanelProps = {
  readonly disabled?: boolean;
  readonly registryScope: string;
};

export function FormulaBatchPanel({ disabled, registryScope }: FormulaBatchPanelProps) {
  return (
    <DocumentBatchPanel
      strategy="formula"
      registryScope={registryScope}
      reviewHrefFor={formulaImportRoute}
      disabled={disabled}
    />
  );
}
