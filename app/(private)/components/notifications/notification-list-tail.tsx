'use client';

import { useInView } from 'react-intersection-observer';

import { Spinner } from '@/components/shared/spinner';
import { Button } from '@/components/ui/button';

import type { ListTail } from './notification-list-state';

export const NOTIFICATION_TAIL_TEXTS = {
  loading: 'Cargando más avisos…',
  error: 'No se pudieron cargar más avisos.',
  retry: 'Reintentar',
  end: 'No hay más avisos. Se conservan 90 días.',
} as const;

const TAIL_CLASS =
  'flex items-center justify-center gap-2.5 px-4 py-4 text-center text-[13px] text-muted-foreground';

export type NotificationListTailProps = {
  readonly tail: ListTail;
  /** El área con scroll del panel; mientras no existe, el centinela no observa. */
  readonly root: Element | null;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
  readonly texts?: typeof NOTIFICATION_TAIL_TEXTS;
};

/** Único archivo de notificaciones que importa `react-intersection-observer`. */
export function NotificationListTail({
  tail,
  root,
  onLoadMore,
  onRetry,
  texts = NOTIFICATION_TAIL_TEXTS,
}: NotificationListTailProps) {
  // Con `skip` el observador solo vive con `tail === 'more'`: nunca hay dos lotes en vuelo y tras
  // un fallo no se reintenta solo.
  const { ref } = useInView({
    root,
    rootMargin: '0px 0px 120px 0px',
    skip: tail !== 'more' || root === null,
    fallbackInView: true,
    onChange: (inView) => {
      if (inView) onLoadMore();
    },
  });

  return (
    <>
      <div ref={ref} data-testid="notification-list-sentinel" aria-hidden="true" className="h-px w-full" />
      {tail === 'loading' && (
        <div role="status" className={TAIL_CLASS}>
          <Spinner />
          {texts.loading}
        </div>
      )}
      {tail === 'error' && (
        <div role="alert" className={TAIL_CLASS}>
          {texts.error}
          <Button variant="outline" size="sm" touch onClick={onRetry}>
            {texts.retry}
          </Button>
        </div>
      )}
      {tail === 'end' && <div className={TAIL_CLASS}>{texts.end}</div>}
    </>
  );
}
