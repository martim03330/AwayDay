// Adds to app.json what must not (or cannot) live in the repository. EAS fills these at build time from its
// environment variables (set once with `eas env:create`, see docs/PASSOS-ANDROID.md and docs/LOGIN-SOCIAL.md):
// - GOOGLE_MAPS_ANDROID_API_KEY: Maps SDK for Android, restricted to this package and its signing certificate. Only
//   draws the map; map loads on Android are free. Without it a map screen closes the app on Android builds.
// - GOOGLE_SERVICES_JSON: the Firebase google-services.json (a file variable), needed for Android push (FCM).
// - GOOGLE_IOS_URL_SCHEME: the iOS OAuth client id reversed («com.googleusercontent.apps.…»), for «Continuar com
//   Google». The Google sign-in plugin registers it as a URL scheme so Google's sheet can return to the app. When it
//   is missing it is derived from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (the same id, reversed): Google's SDK closes the
//   app if the client id is set without its scheme. With neither, the plugin is left out and the button is hidden.
// Locally (Expo Go) none is needed: Expo Go brings its own maps and push, and has no Google sign-in.
module.exports = ({ config }) => {
  const android = { ...config.android };
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (mapsKey) {
    android.config = { ...android.config, googleMaps: { apiKey: mapsKey } };
  }
  if (process.env.GOOGLE_SERVICES_JSON) {
    android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }
  const plugins = [...(config.plugins ?? [])];
  const googleUrlScheme =
    process.env.GOOGLE_IOS_URL_SCHEME || reversedClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  if (googleUrlScheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleUrlScheme }]);
  }
  return { ...config, android, plugins };
};

/** «123-abc.apps.googleusercontent.com» → «com.googleusercontent.apps.123-abc» (or `undefined`). */
function reversedClientId(clientId) {
  const suffix = '.apps.googleusercontent.com';
  if (!clientId || !clientId.endsWith(suffix)) return undefined;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}
