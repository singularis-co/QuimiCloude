import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export type PageHeaderBreadcrumbItem = {
  readonly label: string;
  readonly href?: string;
};

export type PageHeaderProps = {
  readonly title: ReactNode;
  readonly titleTestId?: string;
  readonly actions?: ReactNode;
  readonly breadcrumb?: {
    readonly label: string;
    readonly items: readonly PageHeaderBreadcrumbItem[];
  };
};

function Breadcrumb({ label, items }: NonNullable<PageHeaderProps['breadcrumb']>) {
  const lastIndex = items.length - 1;

  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex items-center gap-2">
            {index > 0 ? <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" /> : null}
            {index === lastIndex ? (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Las consultas de ancho miden el contenedor más cercano, que es `PageShell`.
export function PageHeader({ title, titleTestId, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div data-slot="page-header" className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {breadcrumb ? <Breadcrumb {...breadcrumb} /> : null}
        <h1
          data-testid={titleTestId}
          className="text-[30px] font-semibold tracking-tight @max-[760px]:text-2xl"
        >
          {title}
        </h1>
      </div>
      {actions ? (
        <div
          data-slot="page-header-actions"
          className="flex flex-wrap items-center gap-2 @max-[760px]:w-full @max-[760px]:*:flex-1"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
