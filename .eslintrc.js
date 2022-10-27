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
      files: ["src/*/**.ts", "src/*/**.tsx"],
      excludedFiles: ["src/convex/**/*.ts", "src/convex/**/*.tsx"],
      globals: { process: true },
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.json"],
      },
    },
    {
      files: ["src/convex/**/*.ts", "src/convex/**/*.tsx"],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./src/convex/tsconfig.json"],
      },
    },
  ],
};
