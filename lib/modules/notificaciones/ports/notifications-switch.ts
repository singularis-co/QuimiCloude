/** Si el añadido de notificaciones está activo en la empresa. */
export interface NotificationsSwitch {
  isOn(companyId: string): Promise<boolean>;
}
