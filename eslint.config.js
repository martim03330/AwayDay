// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

// Newer JavaScript that the Hermes engine in Expo Go does not have. TypeScript does not warn about it, and
// `toSorted` crashed the app on open. The Edge Functions run on Deno, which has all of these.
const NOT_IN_HERMES = "Not available in Hermes (Expo Go): the app crashes at runtime. Use an older equivalent.";

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "supabase/functions/*"],
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        { property: "toSorted", message: NOT_IN_HERMES },
        { property: "toReversed", message: NOT_IN_HERMES },
        { property: "toSpliced", message: NOT_IN_HERMES },
        { object: "Object", property: "groupBy", message: NOT_IN_HERMES },
        { object: "Map", property: "groupBy", message: NOT_IN_HERMES },
        { object: "Promise", property: "withResolvers", message: NOT_IN_HERMES },
        { object: "Array", property: "fromAsync", message: NOT_IN_HERMES },
      ],
    },
  },
]);
