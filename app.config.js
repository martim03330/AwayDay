// Adds to app.json the two Android secrets that must not live in the repository. EAS fills them at build time from
// its environment variables (set once with `eas env:create`, see docs/PASSOS-ANDROID.md):
// - GOOGLE_MAPS_ANDROID_API_KEY: Maps SDK for Android, restricted to this package and its signing certificate. Only
//   draws the map; map loads on Android are free. Without it a map screen closes the app on Android builds.
// - GOOGLE_SERVICES_JSON: the Firebase google-services.json (a file variable), needed for Android push (FCM).
// Locally (Expo Go) neither is needed: Expo Go brings its own.
module.exports = ({ config }) => {
  const android = { ...config.android };
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (mapsKey) {
    android.config = { ...android.config, googleMaps: { apiKey: mapsKey } };
  }
  if (process.env.GOOGLE_SERVICES_JSON) {
    android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }
  return { ...config, android };
};
