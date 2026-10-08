// One rule, deliberately: no-undef.
//
// esbuild compiles a reference to an undeclared name without complaint, so
// `npm run build` passing has never been evidence that the app renders. Twice
// in one session that blind spot took the whole dashboard down behind the error
// boundary — most recently `kLabel`, produced by a substring rename that also
// rewrote `perfSleeveLabel`. This catches that class before it ships.
//
// Style rules are intentionally absent: this is a crash gate, not a linter, and
// a noisy config would get bypassed.
import globals from "globals";

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    rules: { "no-undef": "error" },
  },
];
