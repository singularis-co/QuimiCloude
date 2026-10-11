import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type UrlTabItem = {
  readonly value: string;
  readonly href: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly count?: number;
  readonly testId?: string;
};

export type UrlTabsProps = {
  readonly label: string;
  readonly current: string;
  readonly items: readonly UrlTabItem[];
  readonly testId?: string;
};

// Sin 'use client' a propósito: así un Server Component puede pasar el icono, que es una función.
export function UrlTabs({ label, current, items, testId }: UrlTabsProps) {
  return (
    <Tabs value={current} className="max-w-full min-w-0">
      <TabsList
        aria-label={label}
        data-testid={testId}
        className="relative h-auto max-w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-[10px] p-1 [scrollbar-width:none] group-data-horizontal/tabs:h-auto"
      >
        <TabsIndicator />
        {items.map(({ value, href, label: itemLabel, icon: Icon, count, testId: itemTestId }) => (
          <TabsTrigger
            key={value}
            value={value}
            nativeButton={false}
            render={<Link href={href} />}
            data-testid={itemTestId}
            className="h-auto min-h-11 flex-none gap-2 rounded-lg px-3.5 text-[13px] text-muted-foreground transition-colors duration-(--dur-base) ease-(--ease-standard) hover:text-foreground data-active:bg-transparent data-active:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-none dark:text-muted-foreground dark:data-active:border-transparent dark:data-active:bg-transparent"
          >
            {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
            <span>{itemLabel}</span>
            {count === undefined ? null : (
              <span
                data-slot="url-tabs-count"
                className="inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-foreground/8 px-1.5 text-[11px] font-semibold tabular-nums"
              >
                {count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
