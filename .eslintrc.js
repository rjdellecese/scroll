module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["eslint:recommended", "plugin:react-hooks/recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: [
    "@typescript-eslint",
    "fp-ts",
    "simple-import-sort",
    "no-type-assertion",
    "unicorn",
    "react",
  ],
  root: true,
  rules: {
    strict: "error",
    "simple-import-sort/imports": "warn",
    "simple-import-sort/exports": "warn",
    "no-warning-comments": "warn",
    "@typescript-eslint/consistent-type-imports": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
    ],
    "no-type-assertion/no-type-assertion": "warn",
    "no-unused-vars": "off",
    "no-redeclare": "off", // `fp-ts` relies on redeclarations for its implementation of higher-kinded types
    "react-hooks/exhaustive-deps": [
      "warn",
      {
        additionalHooks:
          "(useStableEffect|useStableLayoutEffect|useStableCallback|useStableMemo)",
      },
    ],
  },
  overrides: [
    {
      files: [".eslintrc.js", "jest.config.js"],
      env: {
        node: true,
        browser: false,
      },
    },
    { files: ["tailwind.config.js"], env: { node: true } },
    // https://stackoverflow.com/a/64488474
    {
      files: ["src/**/*.ts", "src/**/*.tsx"],
      excludedFiles: ["src/convex/**/*.ts", "src/netlify/**/*.ts"],
      globals: { process: true },
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.json"],
        ecmaFeatures: {
          jsx: true,
        },
      },
      rules: {
        "unicorn/filename-case": ["error", { case: "kebabCase" }],
        "react/self-closing-comp": "warn",
      },
    },
    {
      files: ["src/convex/**/*.ts"],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./src/convex/tsconfig.json"],
      },
      rules: {
        "unicorn/filename-case": ["error", { case: "camelCase" }],
      },
    },
    {
      files: ["src/netlify/**/*.ts"],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./src/netlify/tsconfig.json"],
      },
      rules: {
        "unicorn/filename-case": ["error", { case: "kebabCase" }],
      },
    },
  ],
};
