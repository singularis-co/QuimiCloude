/**
 * El caso de uso de la EMISION DE ENLACES: por cada archivo de la tanda, una ruta dentro del bucket
 * y un enlace firmado con el que el navegador subira los bytes por su cuenta.
 *
 * LOS CINCO PASOS, EN ESTE ORDEN, y el orden ES el requisito:
 *
 *   1. `requirePermission` — PRIMERA LINEA, antes del esquema y antes de tocar ningun puerto. Si la
 *      validacion fuera antes, un actor sin derecho a pedir nada recibiria `invalid_input` y sabria
 *      algo del sistema solo por haber preguntado mal; y si el puerto sonara antes, el rechazo ya
 *      habria dejado una firma emitida.
 *   2. La conexion del proveedor IA de la empresa. Va despues del permiso para que quien no puede
 *      subir no aprenda nada de la empresa, y antes del esquema para que quien si puede reciba el
 *      motivo real y no un `invalid_input`. Rechazar aqui evita PDFs subidos sin nada que los lea.
 *   3. El esquema de la tanda. Tambien SIN tocar ningun puerto: una tanda por encima del tope se
 *      rechaza ENTERA, y eso solo es cierto si el tope se aplica antes del primer `createSignedUpload`
 *      y no dentro del bucle que va firmando.
 *   4. Las rutas, construidas AQUI con la empresa del actor. **El cliente no propone ruta**: no hay
 *      ningun campo de entrada por el que una ruta pueda llegar hasta el puerto, asi que elegir donde
 *      se escribe —o escribir en la carpeta de otra empresa— es inexpresable, no «esta validado».
 *   5. Un enlace firmado por archivo.
 *
 * **La caducidad que se informa es la del reloj de ESTA operacion, no la de cada firma.** Toda la
 * tanda recibe un unico instante, calculado una sola vez: diez archivos no pueden vencer en diez
 * momentos distintos solo porque el reloj avance mientras se firman. El efecto secundario, dicho
 * entero: como cada firma se emite un poco DESPUES de ese instante, el vencimiento informado del
 * ultimo archivo queda ligeramente ANTERIOR al real. Es la desviacion CONSERVADORA —el enlace vive
 * algo mas de lo que se promete, nunca menos—, asi que nunca engaña a favor de quien sube.
 *
 * **Lo que esta operacion NO hace, y se dice porque la ausencia es el requisito:** no recibe, no lee
 * y no reenvia los BYTES de ningun PDF —viajan del navegador al bucket sin atravesar la aplicacion—;
 * no convierte nada; no devuelve ninguna URL completa de lectura; y no escribe ni lee ninguna fila.
 * No tiene por donde: sus dependencias son el puerto de almacenamiento, la pregunta de si hay
 * proveedor IA y un reloj.
 *
 * Dominio puro: solo su propio `domain/`, sus `ports/` y el tipo del reloj.
 */
import { requirePermission, type Actor, DOCUMENT_UPLOAD_PERMISSION } from './actor';
import { buildDocumentPath } from './document-path';
import { AiProviderMissingError, ValidationError } from './errors';
import { MILLISECONDS_PER_SECOND, PROVIDER_UPLOAD_LINK_TTL_SECONDS } from './limits';
import { issueUploadLinksSchema } from './upload-input';

import type { AiProviderGateway } from '../ports/ai-provider-gateway';
import type { DocumentStorage, SignedUpload } from '../ports/document-storage';

export type IssueUploadLinksDeps = {
  /** El bucket, dicho sin nombrarlo. */
  readonly storage: DocumentStorage;
  /** Solo la pregunta de si la empresa tiene proveedor IA: aqui no se lee nada. */
  readonly aiProvider: Pick<AiProviderGateway, 'isConfigured'>;
  /**
   * El instante de emision, inyectable, con `() => new Date()` por defecto.
   *
   * No es comodidad de test: la caducidad que se devuelve se cuenta desde ESTE instante y con el
   * plazo que el PROVEEDOR le da a un enlace de subida, de modo que la respuesta no dependa del
   * reloj —ni del criterio— de cada adaptador.
   */
  readonly now?: () => Date;
};

/**
 * La salida: RUTAS Y ENLACES, y nada mas.
 *
 * No hay hueco donde colar el resultado de una conversion ni una URL de lectura: quien quisiera
 * devolverlos tendria que cambiar este tipo, que es justo el aviso que se busca.
 */
export type IssuedUploadBatch = { readonly uploads: readonly SignedUpload[] };

export function createIssueUploadLinks(
  deps: IssueUploadLinksDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<IssuedUploadBatch> {
  const now = deps.now ?? ((): Date => new Date());

  return async function issueUploadLinks(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<IssuedUploadBatch> {
    // 1. Antes que nada, y sin excepcion.
    requirePermission(actor, DOCUMENT_UPLOAD_PERMISSION);

    // 2. Sin proveedor IA no hay quien lea lo que se suba.
    if (!(await deps.aiProvider.isConfigured(actor.companyId))) {
      throw new AiProviderMissingError();
    }

    // 3. Ningun puerto de almacenamiento se ha tocado todavia: un rechazo aqui no deja firmas.
    const parsed = issueUploadLinksSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    // La caducidad se calcula UNA vez para toda la tanda: firmar diez archivos no puede dar diez
    // vencimientos distintos solo porque el reloj avance entre llamada y llamada.
    //
    // El plazo es el del PROVEEDOR, no uno elegido aqui: la firma de subida no admite ninguno, asi
    // que lo unico honesto que se puede informar es cuando muere el enlace de verdad.
    const expiresAt = new Date(
      now().getTime() + PROVIDER_UPLOAD_LINK_TTL_SECONDS * MILLISECONDS_PER_SECOND,
    ).toISOString();

    // 4 y 5. Una ruta nueva por archivo, SIEMPRE bajo la empresa del actor. El nombre que mando
    // quien sube no entra en la ruta; solo sirve para que la pantalla sepa de que archivo es cada
    // enlace, y por eso ni siquiera se lee aqui.
    const uploads = await Promise.all(
      parsed.data.files.map(async (): Promise<SignedUpload> => {
        const firmado = await deps.storage.createSignedUpload(buildDocumentPath(actor.companyId));
        // La caducidad se reescribe con la de la tanda: el adaptador entrega la firma y la cuenta
        // desde SU reloj, y dos firmas seguidas darian dos instantes distintos para el mismo plazo.
        // El plazo en si es el mismo, el del proveedor, en su unica definicion.
        return { ...firmado, expiresAt };
      }),
    );

    return { uploads };
  };
}
