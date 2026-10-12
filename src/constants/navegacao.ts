/**
 * No iOS 26 «scroll edge effects» on any screen: by default iOS blurs and tints the top (under the status bar) and the
 * bottom (above the tab bar) with the page colour whenever content passes under them, so the bars seemed to change
 * colour as you scrolled (testers' feedback). Every Stack in the app uses this.
 */
export const SEM_EFEITOS_NAS_BORDAS = {
  top: 'hidden',
  bottom: 'hidden',
  left: 'hidden',
  right: 'hidden',
} as const;
