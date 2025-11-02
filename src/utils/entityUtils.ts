/**
 * Entity utility functions
 */

export function changeEntityIcon(entityId: string, iconValue: string): void {
  const icons = JSON.parse(localStorage.getItem('ha_dashboard_icons') ?? '{}');

  if (iconValue) {
    icons[entityId] = iconValue;
  } else {
    delete icons[entityId];
  }

  localStorage.setItem('ha_dashboard_icons', JSON.stringify(icons));
}
