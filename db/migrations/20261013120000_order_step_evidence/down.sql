-- Reversion exacta de `migration.sql`. `DROP TABLE` se lleva sus indices, sus CHECK y sus FK, que
-- son de esta tabla: no queda nada en `orders`, `users` ni `companies`. Sin CASCADE: si algo
-- posterior depende de la tabla o del tipo, revertir esta sola debe fallar.

DROP TABLE "order_step_evidence";

DROP TYPE "evidence_phase";
