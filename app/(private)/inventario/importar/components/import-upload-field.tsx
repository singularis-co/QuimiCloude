'use client';

import { FileIcon, FileSpreadsheetIcon, UploadIcon } from 'lucide-react';
import { useId, useRef } from 'react';

import { Button } from '@/components/ui/button';
import {
  INVENTORY_IMPORT_ACCEPT,
  INVENTORY_IMPORT_MAX_FILE_BYTES,
  INVENTORY_IMPORT_MAX_ROWS,
} from '@/lib/modules/inventario';
import { cn } from '@/lib/utils';

import {
  UPLOAD_CHANGE_LABEL,
  UPLOAD_EMPTY_TESTID,
  UPLOAD_FIELD_TESTID,
  UPLOAD_FILE_NAME_TESTID,
  UPLOAD_FILE_SIZE_TESTID,
  UPLOAD_FORMATS_LABEL,
  UPLOAD_INPUT_LABEL,
  UPLOAD_INPUT_TESTID,
  UPLOAD_TOO_LARGE_TESTID,
  UPLOAD_TRIGGER_LABEL,
  UPLOAD_TRIGGER_TESTID,
  formatBytes,
  tooLargeWarning,
  uploadHint,
} from './import-texts';

export function exceedsImportMaxBytes(file: File): boolean {
  return file.size > INVENTORY_IMPORT_MAX_FILE_BYTES;
}

const ZONE_CLASS =
  'flex rounded-xl border-[1.5px] border-dashed border-input bg-card transition-[border-color,background-color] duration-(--dur-base) ease-(--ease-standard)';

const ICON_BOX_CLASS =
  'inline-flex flex-none items-center justify-center rounded-lg border border-border bg-muted text-primary';

export type ImportUploadFieldProps = {
  readonly file: File | null;
  readonly onSelect: (file: File) => void;
  readonly disabled?: boolean;
};

export function ImportUploadField({ file, onSelect, disabled = false }: ImportUploadFieldProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const warningId = `${inputId}-warning`;
  const inputRef = useRef<HTMLInputElement>(null);
  const tooLarge = file !== null && exceedsImportMaxBytes(file);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      touch
      disabled={disabled}
      data-testid={UPLOAD_TRIGGER_TESTID}
      onClick={() => inputRef.current?.click()}
    >
      <FileIcon aria-hidden />
      {file === null ? UPLOAD_TRIGGER_LABEL : UPLOAD_CHANGE_LABEL}
    </Button>
  );

  return (
    <div className="flex flex-col gap-2" data-testid={UPLOAD_FIELD_TESTID}>
      {/*
        El input sigue siendo el control real y el que abre el selector de Archivos en iOS y
        Android; el botón solo lo dispara para tener un objetivo táctil visible.
      */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={INVENTORY_IMPORT_ACCEPT}
        aria-label={UPLOAD_INPUT_LABEL}
        aria-describedby={tooLarge ? `${hintId} ${warningId}` : hintId}
        aria-invalid={tooLarge ? true : undefined}
        className="sr-only text-base"
        tabIndex={-1}
        disabled={disabled}
        data-testid={UPLOAD_INPUT_TESTID}
        onChange={(event) => {
          const picked = event.target.files?.[0];
          // Sin esto, volver a elegir el mismo archivo no dispara `change`.
          event.target.value = '';
          if (picked !== undefined) onSelect(picked);
        }}
      />
      {file === null ? (
        <div
          className={cn(ZONE_CLASS, 'flex-col items-center justify-center gap-2 px-6 py-10 text-center')}
          data-testid={UPLOAD_EMPTY_TESTID}
        >
          <span className={cn(ICON_BOX_CLASS, 'size-16 rounded-[10px]')}>
            <UploadIcon className="size-6" aria-hidden />
          </span>
          <span className="font-mono text-xs text-muted-foreground">{UPLOAD_FORMATS_LABEL}</span>
          {trigger}
        </div>
      ) : (
        <div
          className={cn(ZONE_CLASS, 'flex-row flex-wrap items-center gap-3.5 p-3.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--dur-base)')}
        >
          <span className={cn(ICON_BOX_CLASS, 'size-10')}>
            <FileSpreadsheetIcon className="size-5" aria-hidden />
          </span>
          <p className="flex min-w-0 flex-1 flex-col gap-0.5" data-testid={UPLOAD_FILE_NAME_TESTID}>
            <span className="truncate font-mono text-sm font-semibold tabular-nums">{file.name}</span>
            <span
              className="font-mono text-xs text-muted-foreground tabular-nums"
              data-testid={UPLOAD_FILE_SIZE_TESTID}
            >
              {formatBytes(file.size)}
            </span>
          </p>
          {trigger}
        </div>
      )}
      <p id={hintId} className="text-xs text-muted-foreground">
        {uploadHint(INVENTORY_IMPORT_MAX_FILE_BYTES, INVENTORY_IMPORT_MAX_ROWS)}
      </p>
      {tooLarge ? (
        <p
          id={warningId}
          role="alert"
          className="text-sm text-destructive"
          data-testid={UPLOAD_TOO_LARGE_TESTID}
        >
          {tooLargeWarning(file.size, INVENTORY_IMPORT_MAX_FILE_BYTES)}
        </p>
      ) : null}
    </div>
  );
}
