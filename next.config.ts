import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Dos binarios nativos (no JS) que Turbopack no puede meter en un chunk ESM: sin esta linea
   * `next build` sale con exit 1 (medido el 2026-09-21). El `await import()` del adaptador del
   * canvas no basta -el especificador sigue siendo analizable-, y a `sharp`, que su adaptador
   * importa de forma estatica, ese argumento ni le aplica.
   *
   * `tests/unit/documentos/canvas-no-empaquetado.test.ts` lo hace cumplir.
   */
  serverExternalPackages: ['@napi-rs/canvas', 'sharp'],
  /**
   * Por defecto Next corta las Server Actions en 1 MB. Las imagenes de recetas y productos
   * admiten hasta 5 MB (validacion en sus modulos), asi que el limite se alinea a 5 MB.
   */
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
