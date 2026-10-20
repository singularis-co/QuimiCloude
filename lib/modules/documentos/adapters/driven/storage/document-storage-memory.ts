import { prisma } from '@/lib/shared/db/prisma';

import {
  MILLISECONDS_PER_SECOND,
  PROVIDER_UPLOAD_LINK_TTL_SECONDS,
} from '../../../domain/limits';

import type { DocumentStorage, SignedUpload } from '../../../ports/document-storage';

/**
 * Implementa el puerto del almacenamiento EN MEMORIA, para que el recorrido de extremo a extremo
 * pueda correr sin red y sin bucket configurado.
 *
 * No se cablea nunca por defecto: el punto de composicion solo lo elige cuando
 * `DOCUMENTS_E2E_DOUBLES` esta puesta, y ningun archivo versionado la pone salvo la configuracion
 * de Playwright.
 *
 * **Guarda las rutas que firma** y se niega a leer o borrar una que no haya firmado: un doble que
 * respondiera a cualquier ruta dejaria pasar un fallo de emparejamiento archivo <-> ruta, que es
 * justo una de las cosas que el recorrido viene a comprobar.
 *
 * **Los bytes no se guardan.** La subida la hace el navegador contra `uploadUrl`, que el propio
 * recorrido intercepta, asi que aqui nunca llega un byte: `download` devuelve siempre el mismo PDF
 * minimo valido, que es lo que la conversion necesita para abrir un documento de una pagina.
 *
 * **Salvo un archivo marcado.** Si el nombre original de la fila de esa ruta lleva
 * `UNREADABLE_E2E_NAME_MARK`, `download` devuelve bytes que no son un PDF. Asi un recorrido puede
 * hacer fallar, de forma determinista, un archivo de una tanda y no los demas. El nombre es lo
 * unico del archivo que llega al servidor: los bytes no llegan y la ruta la pone el servidor.
 * Falla al rasterizar, asi que solo afecta a la estrategia que lee por imagenes (catalogo). Es un
 * fallo definitivo (`unexpected`), no un corte de almacenamiento, que la cola en linea no reintenta.
 */

/** La marca, en el nombre original del archivo, que hace ilegible su descarga. */
export const UNREADABLE_E2E_NAME_MARK = 'e2e-ilegible';

/** Lo que devuelve la descarga de un archivo marcado: texto, sin cabecera `%PDF`. */
const BYTES_ILEGIBLES = new TextEncoder().encode(`no es un PDF (${UNREADABLE_E2E_NAME_MARK})`);

/** El nombre original que subio quien encolo esa ruta, o `null` si no lo hay. */
export type OriginalNameOf = (path: string) => Promise<string | null>;

/** La ruta es unica por empresa y empieza por ella, asi que basta para dar con su fila. */
const originalNameInDatabase: OriginalNameOf = async (path) => {
  const file = await prisma.documentFile.findFirst({ where: { path }, select: { originalName: true } });
  return file?.originalName ?? null;
};

/**
 * Dominio reservado por el estandar: NO resuelve en ningun DNS. Si alguien olvidara interceptar la
 * subida, la peticion falla ruidosamente en vez de salir a un servidor de verdad.
 */
const E2E_STORAGE_ORIGIN = 'https://documentos-e2e.invalid';

/** El cuerpo de un PDF de UNA pagina en blanco, un objeto por elemento y en orden de numeracion. */
const OBJETOS_DEL_PDF_MINIMO = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>',
] as const;

/**
 * El ancho, en cifras, del desplazamiento de una entrada de la tabla `xref`. Lo fija el formato
 * PDF, y se dice con el propio relleno para no escribir un numero suelto que ya tiene otro dueno
 * en este modulo.
 */
const ANCHO_DEL_DESPLAZAMIENTO = '0000000000'.length;

/**
 * Arma el PDF minimo con su tabla `xref` calculada, no escrita a mano: los desplazamientos de un
 * PDF son posiciones en bytes, y un numero copiado deja de ser cierto en cuanto alguien toque una
 * linea de arriba. Todo el contenido es ASCII, asi que la longitud de la cadena ES la del byte.
 */
function armarPdfMinimo(): Uint8Array {
  const cabecera = '%PDF-1.4\n';
  const desplazamientos: number[] = [];
  let cuerpo = '';

  OBJETOS_DEL_PDF_MINIMO.forEach((objeto, indice) => {
    desplazamientos.push(cabecera.length + cuerpo.length);
    cuerpo += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });

  const inicioXref = cabecera.length + cuerpo.length;
  const total = OBJETOS_DEL_PDF_MINIMO.length + 1;
  const entradas = desplazamientos
    .map((desplazamiento) => `${String(desplazamiento).padStart(ANCHO_DEL_DESPLAZAMIENTO, '0')} 00000 n \n`)
    .join('');
  const xref = `xref\n0 ${total}\n0000000000 65535 f \n${entradas}`;
  const cola = `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  return new TextEncoder().encode(cabecera + cuerpo + xref + cola);
}

const PDF_MINIMO = armarPdfMinimo();

export type DocumentStorageMemoryDeps = {
  readonly originalNameOf: OriginalNameOf;
};

export function createDocumentStorageMemory(deps: DocumentStorageMemoryDeps): DocumentStorage {
  /** Las rutas firmadas, vivas mientras viva el proceso del servidor de pruebas. */
  const rutasFirmadas = new Set<string>();

  function exigirRutaFirmada(path: string, operacion: string): void {
    if (!rutasFirmadas.has(path)) {
      throw new Error(`el almacenamiento en memoria no firmo la ruta ${path}: ${operacion} imposible`);
    }
  }

  return {
    createSignedUpload(path: string): Promise<SignedUpload> {
      rutasFirmadas.add(path);
      const expiresAt = new Date(
        Date.now() + PROVIDER_UPLOAD_LINK_TTL_SECONDS * MILLISECONDS_PER_SECOND,
      ).toISOString();

      return Promise.resolve({
        path,
        uploadUrl: `${E2E_STORAGE_ORIGIN}/upload/${path}`,
        token: crypto.randomUUID(),
        expiresAt,
      });
    },

    createSignedReadUrl(path: string): Promise<string> {
      exigirRutaFirmada(path, 'firmar la lectura');
      return Promise.resolve(`${E2E_STORAGE_ORIGIN}/read/${path}`);
    },

    download(path: string): Promise<Uint8Array> {
      exigirRutaFirmada(path, 'la descarga');
      return deps
        .originalNameOf(path)
        .then((name) => (name?.includes(UNREADABLE_E2E_NAME_MARK) === true ? BYTES_ILEGIBLES : PDF_MINIMO));
    },

    remove(path: string): Promise<void> {
      rutasFirmadas.delete(path);
      return Promise.resolve();
    },
  };
}

/** La que elige la composicion: busca el nombre original en la fila de la ruta. */
export const documentStorageMemory: DocumentStorage = createDocumentStorageMemory({
  originalNameOf: originalNameInDatabase,
});
