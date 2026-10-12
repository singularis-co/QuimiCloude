import { Search } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';

/**
 * El 404 de las páginas privadas: sale dentro del layout privado, con la barra lateral ya filtrada
 * y el control de cerrar sesión, para que quien no tenga permiso siga teniendo por dónde salir.
 *
 * El copy no menciona permisos, roles ni módulos, y no hay enlace ni botón: un destino fijo o
 * «la primera pantalla disponible» delataría qué pantallas existen o cuáles puede ver esa persona.
 *
 * Nunca se llama a `notFound()` desde `app/(private)/layout.tsx`: un `notFound()` en el layout lo
 * hace fallar, responde el límite de arriba y el 404 saldría sin el armazón del layout privado.
 *
 * Contenedor `div` y no `main`: el layout privado ya pinta el único `main`.
 */
export default function PrivateNotFound() {
  return (
    <EmptyState
      testId="private-not-found"
      icon={{ node: <Search />, size: 'lg' }}
      heading={{ level: 1, eyebrow: '404', text: 'No encontramos esta página' }}
      message="Revisa la dirección e inténtalo de nuevo, o continúa desde el menú lateral."
      className="flex min-h-[460px] flex-1 flex-col items-center justify-center gap-3 p-4 text-center md:p-6"
    />
  );
}
