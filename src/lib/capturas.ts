/**
 * Store screenshots and the promo video are taken in demo mode from a build made with `EXPO_PUBLIC_CAPTURAS=true`
 * (see docs/promo/LEIA-ME.md). In that build, the notes that only explain demo mode are left out of the picture.
 * Store builds never set it, so real people always see them.
 */
export const BUILD_DE_CAPTURAS = process.env.EXPO_PUBLIC_CAPTURAS === 'true';
