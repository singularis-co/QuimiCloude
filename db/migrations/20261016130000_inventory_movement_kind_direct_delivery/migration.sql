-- Va sola: Postgres no deja usar un valor de enum recien anadido en la misma transaccion que lo
-- crea, y la migracion siguiente los usa en CHECK y disparadores. Los dos ADD VALUE si pueden ir
-- juntos: ninguno se usa aqui.
ALTER TYPE "InventoryMovementKind" ADD VALUE 'direct_delivery';
ALTER TYPE "InventoryMovementKind" ADD VALUE 'direct_delivery_void';
