// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

// Newer JavaScript that the Hermes engine in Expo Go does not have. TypeScript does not warn about it, and
// `toSorted` crashed the app on open. The Edge Functions run on Deno, which has all of these.
const NOT_IN_HERMES = "Not available in Hermes (Expo Go): the app crashes at runtime. Use an older equivalent.";

// Martim's rule: no em dash in the middle of a sentence in any text of the app (hyphenated words like «chama-se» are
// fine). Comments are not checked.
const SEM_TRAVESSAO = "Sem travessões (—) nos textos da app: usa dois pontos, vírgula ou parênteses.";

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
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["**/__tests__/**", "**/*.test.*"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "Literal[value=/—/]", message: SEM_TRAVESSAO },
        { selector: "TemplateElement[value.raw=/—/]", message: SEM_TRAVESSAO },
        { selector: "JSXText[value=/—/]", message: SEM_TRAVESSAO },
      ],
    },
  },
]);
