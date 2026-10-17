'use client';

import type { ComponentProps, ReactElement, ReactNode } from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { ErrorState } from '@/lib/modules/errores';
import { touchTarget } from '@/lib/shared/ui/touch-target';

export type ConfirmDialogTexts = {
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly dismiss: ReactNode;
  readonly confirm: ReactNode;
  /** Sin él, el botón de confirmar conserva su texto mientras envía. */
  readonly pending?: ReactNode;
};

export type ConfirmDialogTestIds = {
  readonly dialog: string;
  readonly message?: string;
  readonly dismiss: string;
  readonly confirm: string;
  readonly form?: string;
  readonly error?: string;
  readonly errorMessage?: string;
};

export type ConfirmDialogHiddenField = {
  readonly name: string;
  readonly value: string;
  readonly testId?: string;
  /** `value` en vez de `defaultValue`: el valor sigue a la prop en cada render. */
  readonly controlled?: boolean;
};

export type ConfirmDialogSubmit =
  | {
      readonly kind: 'action';
      readonly action: (formData: FormData) => void;
      readonly hidden?: readonly ConfirmDialogHiddenField[];
      readonly formClassName?: string;
    }
  | { readonly kind: 'transition'; readonly onConfirm: () => void };

/**
 * Dónde caen el error y el `<form>`:
 * - `error-before-form`: cabecera, error y, en el form, campos ocultos, `children` y pie.
 * - `error-in-form`: cabecera y, en el form, campos ocultos, `children`, error y pie.
 * - `form-wraps-all`: el form envuelve también la cabecera.
 */
export type ConfirmDialogLayout = 'error-before-form' | 'error-in-form' | 'form-wraps-all';

/**
 * `region`: recuadro con `data-code` y mensaje en `<p>` con `testIds.errorMessage`.
 * `inline`: línea de texto en un `<p>`.
 */
export type ConfirmDialogErrorStyle = 'region' | 'inline';

/**
 * `header`: bajo el título. `after-aside`: tras `aside` y antes del error y del form; con
 * `form-wraps-all`, dentro del form tras la cabecera.
 */
export type ConfirmDialogDescriptionPlacement = 'header' | 'after-aside';

const ERROR_REGION_CLASS = 'rounded-lg border border-destructive/40 p-3 text-sm text-destructive';
const ERROR_INLINE_CLASS = 'text-sm text-destructive';

export type ConfirmDialogFrameProps = {
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Disparador propio. Sin él la apertura la decide quien pasa `open`. */
  readonly trigger?: { readonly render: ReactElement; readonly children: ReactNode };
  readonly testId: string;
  /** Se suma a la clase del contenido. */
  readonly contentClassName?: string;
  readonly children: ReactNode;
};

/**
 * Raíz, disparador y contenido. Se usa sola cuando el cuerpo tiene que montarse y desmontarse con
 * el popup para empezar limpio en cada apertura: el estado vive en el componente que pinta
 * `ConfirmDialogBody`.
 */
export function ConfirmDialogFrame({
  open,
  onOpenChange,
  trigger,
  testId,
  contentClassName,
  children,
}: ConfirmDialogFrameProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger === undefined ? null : (
        <AlertDialogTrigger render={trigger.render}>{trigger.children}</AlertDialogTrigger>
      )}
      <AlertDialogContent className={contentClassName} data-testid={testId}>
        {children}
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Con `confirmSlot` el testid del botón lo pone quien pasa el slot: `testIds.confirm` no se admite. */
export type ConfirmSlotChoice<TTestIds extends { readonly confirm: string }> =
  | { readonly confirmSlot?: undefined; readonly testIds: TTestIds }
  | {
      /** Sustituye al botón de confirmar; su `type`, `disabled` y `data-testid` los pone quien lo pasa. */
      readonly confirmSlot: NonNullable<ReactNode>;
      readonly testIds: Omit<TTestIds, 'confirm'> & { readonly confirm?: never };
    };

export type ConfirmDialogBodyBaseProps = {
  readonly texts: ConfirmDialogTexts;
  readonly variant?: 'default' | 'destructive';
  /** Con form (Server Action) o con transición. Sin él, se usa `onConfirm`. */
  readonly submit?: ConfirmDialogSubmit;
  /** Sin form: se cierra con `onOpenChange(false)` y después se llama. */
  readonly onConfirm?: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  /** Sin él, el pendiente no deshabilita ni marca nada. */
  readonly isPending?: boolean;
  /** `false` deshabilita sin `aria-busy`. */
  readonly announceBusy?: boolean;
  /** Bloqueo adicional al pendiente. */
  readonly confirmDisabled?: boolean;
  readonly confirmDescribedBy?: string;
  /** `button` pinta un `Button` que no cierra el diálogo por sí mismo. */
  readonly confirmAs?: 'action' | 'button';
  readonly dismissDisabled?: boolean;
  readonly error?: ErrorState;
  readonly errorId?: string;
  readonly errorStyle?: ConfirmDialogErrorStyle;
  readonly errorAlertProps?: Partial<Omit<ComponentProps<typeof ErrorAlert>, 'error'>>;
  readonly layout?: ConfirmDialogLayout;
  /** Entre la cabecera y el error, fuera del form. */
  readonly aside?: ReactNode;
  /** Sin ella, la descripción va en la cabecera. */
  readonly descriptionPlacement?: ConfirmDialogDescriptionPlacement;
  /** Dentro del form tras los campos ocultos; sin form, antes del pie. */
  readonly children?: ReactNode;
};

export type ConfirmDialogBodyProps = ConfirmDialogBodyBaseProps &
  ConfirmSlotChoice<Omit<ConfirmDialogTestIds, 'dialog'>>;

/** Cabecera, error, form y pie. No guarda estado: el de la operación es de cada diálogo. */
export function ConfirmDialogBody({
  texts,
  testIds,
  variant,
  submit,
  onConfirm,
  onOpenChange,
  isPending,
  announceBusy = true,
  confirmDisabled = false,
  confirmDescribedBy,
  confirmAs = 'action',
  confirmSlot,
  dismissDisabled,
  error,
  errorId,
  errorStyle = 'region',
  errorAlertProps,
  layout = 'error-before-form',
  aside,
  descriptionPlacement = 'header',
  children,
}: ConfirmDialogBodyProps) {
  const pending = isPending === true;
  const showPendingText = pending && texts.pending !== undefined;

  const description = (
    <AlertDialogDescription data-testid={testIds.message}>{texts.description}</AlertDialogDescription>
  );
  const descriptionInHeader = descriptionPlacement === 'header';
  const lateDescription = descriptionInHeader ? null : description;

  const header = (
    <AlertDialogHeader>
      <AlertDialogTitle>{texts.title}</AlertDialogTitle>
      {descriptionInHeader ? description : null}
    </AlertDialogHeader>
  );

  const errorTestId = testIds.errorMessage;
  const errorRegion =
    error === undefined ? null : (
      <ErrorAlert
        error={error}
        id={errorId}
        testId={testIds.error}
        {...(errorStyle === 'region'
          ? {
              className: ERROR_REGION_CLASS,
              withDataCode: true,
              ...(errorTestId === undefined
                ? {}
                : {
                    renderCatalogued: (catalogued: { readonly message: string }) => (
                      <p data-testid={errorTestId}>{catalogued.message}</p>
                    ),
                  }),
            }
          : { className: ERROR_INLINE_CLASS, cataloguedAs: 'p' as const })}
        {...errorAlertProps}
      />
    );

  // Sin `type` el botón nativo ya es `button`; pasar `type={undefined}` lo borraría del DOM.
  const confirmType =
    submit?.kind === 'action'
      ? { type: 'submit' as const }
      : submit?.kind === 'transition'
        ? {}
        : { type: 'button' as const };
  const handleConfirm =
    submit?.kind === 'action'
      ? undefined
      : submit?.kind === 'transition'
        ? submit.onConfirm
        : () => {
            onOpenChange?.(false);
            onConfirm?.();
          };
  const ConfirmButton = confirmAs === 'button' ? Button : AlertDialogAction;

  const footer = (
    <AlertDialogFooter>
      <AlertDialogCancel
        className={touchTarget}
        disabled={dismissDisabled}
        data-testid={testIds.dismiss}
      >
        {texts.dismiss}
      </AlertDialogCancel>
      {confirmSlot ?? (
        <ConfirmButton
          {...confirmType}
          variant={variant}
          touch
          disabled={pending || confirmDisabled}
          aria-busy={isPending === undefined || !announceBusy ? undefined : pending}
          aria-describedby={confirmDescribedBy}
          data-testid={testIds.confirm}
          onClick={handleConfirm}
        >
          {showPendingText ? texts.pending : texts.confirm}
        </ConfirmButton>
      )}
    </AlertDialogFooter>
  );

  if (submit?.kind !== 'action') {
    return (
      <>
        {header}
        {aside}
        {lateDescription}
        {errorRegion}
        {children}
        {footer}
      </>
    );
  }

  const hiddenFields = (submit.hidden ?? []).map((field) => (
    <input
      key={field.name}
      type="hidden"
      name={field.name}
      {...(field.controlled === true ? { value: field.value } : { defaultValue: field.value })}
      data-testid={field.testId}
    />
  ));

  const form = (
    <form action={submit.action} className={submit.formClassName} data-testid={testIds.form}>
      {layout === 'form-wraps-all' ? header : null}
      {layout === 'form-wraps-all' ? lateDescription : null}
      {hiddenFields}
      {children}
      {layout === 'error-before-form' ? null : errorRegion}
      {footer}
    </form>
  );

  if (layout === 'form-wraps-all') return form;

  return (
    <>
      {header}
      {aside}
      {lateDescription}
      {layout === 'error-before-form' ? errorRegion : null}
      {form}
    </>
  );
}

export type ConfirmDialogBaseProps = Omit<ConfirmDialogFrameProps, 'testId' | 'children'> &
  Omit<ConfirmDialogBodyBaseProps, 'onOpenChange'>;

export type ConfirmDialogProps = ConfirmDialogBaseProps & ConfirmSlotChoice<ConfirmDialogTestIds>;

/**
 * Base de los diálogos de confirmación. Pinta; el `useActionState`, la transición y el efecto de
 * éxito se quedan en quien la usa.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  contentClassName,
  ...body
}: ConfirmDialogProps) {
  return (
    <ConfirmDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      contentClassName={contentClassName}
      testId={body.testIds.dialog}
    >
      <ConfirmDialogBody {...body} onOpenChange={onOpenChange} />
    </ConfirmDialogFrame>
  );
}
