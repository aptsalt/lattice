import { ConnectedPosition } from '@angular/cdk/overlay';

/** Opens above the origin (composer menus), falls back to below. */
export const MENU_ABOVE: ConnectedPosition[] = [
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
];

/** Opens below the origin, right-aligned (header menus). */
export const MENU_BELOW: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
];
