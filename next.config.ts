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
   * Por defecto Next corta las Server Actions en 1 MB. Vercel corta el cuerpo de una peticion en
   * 4.5 MB, asi que el limite se alinea a ese techo, y las imagenes de recetas y productos se
   * validan en sus modulos a 4.4 MB para dejar margen al resto del formulario.
   */
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
};

export default nextConfig;
