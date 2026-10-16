/**
 * Si la empresa tiene activa la lectura de PDF. El trabajo de la cola corre sin sesión, así que no
 * hay permisos recortados que mirar: lo pregunta por la empresa del archivo.
 */
export interface PdfReadingSwitch {
  isOn(companyId: string): Promise<boolean>;
}
