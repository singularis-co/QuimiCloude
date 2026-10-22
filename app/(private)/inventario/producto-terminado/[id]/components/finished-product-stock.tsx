import type { FinishedStockSummary, PackagedQuantity } from '@/lib/modules/inventario';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { trimDecimal } from '@/lib/shared/ui/decimal-display';

type UnitLike = { readonly name: string; readonly symbol: string | null } | null;

/** Símbolo de la unidad, o su nombre si no tiene; `null` sin unidad. */
export function unitLabelOf(unit: UnitLike): string | null {
  if (unit === null) return null;
  return unit.symbol ?? unit.name;
}

/** Cantidad decimal sin ceros sobrantes, con su unidad si la hay. */
export function quantityText(value: string, unitLabel: string | null): string {
  const amount = trimDecimal(value);
  return unitLabel === null ? amount : `${amount} ${unitLabel}`;
}

export function packagesText(packages: number): string {
  return packages === 1 ? '1 envase' : `${packages} envases`;
}

/** «10 envases + 0.5 L»; sin contenido de envase, la marca de ausencia. */
export function packagedText(packaged: PackagedQuantity | null, unitLabel: string | null): string {
  if (packaged === null) return EMPTY_MARK;
  const packages = packagesText(packaged.packages);
  return packaged.remainder === null
    ? packages
    : `${packages} + ${quantityText(packaged.remainder, unitLabel)}`;
}

export type FinishedProductStockProps = {
  readonly stock: FinishedStockSummary;
  readonly unitLabel: string | null;
};

export function FinishedProductStock({ stock, unitLabel }: FinishedProductStockProps) {
  return (
    <section aria-labelledby="finished-product-stock-heading" className="flex flex-col gap-4">
      <h2 id="finished-product-stock-heading" className="text-lg font-semibold">
        Existencia
      </h2>
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted-foreground">Total en unidad base</dt>
        <dd className="font-medium tabular-nums" data-testid="finished-product-stock-total">
          {quantityText(stock.total, unitLabel)}
        </dd>
        <dt className="text-muted-foreground">En envases</dt>
        <dd>
          {stock.byPackageContent.length === 0 ? (
            <span data-testid="finished-product-stock-packages-empty">{EMPTY_MARK}</span>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="finished-product-stock-packages">
              {stock.byPackageContent.map((entry) => (
                <li
                  key={entry.packageContent}
                  className="tabular-nums"
                  data-package-content={entry.packageContent}
                >
                  {`${packagesText(entry.packages)} de ${quantityText(entry.packageContent, unitLabel)}`}
                  {entry.remainder === null
                    ? null
                    : ` + ${quantityText(entry.remainder, unitLabel)}`}
                </li>
              ))}
            </ul>
          )}
        </dd>
        {stock.withoutPackage === null ? null : (
          <>
            <dt className="text-muted-foreground">Sin envase</dt>
            <dd className="tabular-nums" data-testid="finished-product-stock-unpackaged">
              {quantityText(stock.withoutPackage, unitLabel)}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
