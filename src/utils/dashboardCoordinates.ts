export interface DashboardPoint {
  x: number;
  y: number;
}

export function clientToDashboardPoint(
  dashboard: HTMLElement,
  clientX: number,
  clientY: number
): DashboardPoint {
  const bounds = dashboard.getBoundingClientRect();
  const width = dashboard.offsetWidth;
  const height = dashboard.offsetHeight;

  return {
    x: bounds.width === 0 ? 0 : ((clientX - bounds.left) / bounds.width) * width,
    y: bounds.height === 0 ? 0 : ((clientY - bounds.top) / bounds.height) * height,
  };
}
