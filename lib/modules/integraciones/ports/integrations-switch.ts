/** ¿Tiene la empresa prendido el añadido de integraciones? */
export interface IntegrationsSwitch {
  isOn(companyId: string): Promise<boolean>;
}
