module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["eslint:recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "fp-ts", "simple-import-sort"],
  root: true,
  rules: {
    strict: "error",
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    "no-warning-comments": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
    ],
    "no-unused-vars": "off",
    "no-redeclare": "off", // `fp-ts` relies on redeclarations for its implementation of higher-kinded types
  },
  overrides: [
    {
      files: [".eslintrc.js"],
      env: {
        node: true,
        browser: false,
      },
    },
    { files: ["tailwind.config.js"], env: { node: true } },
    // https://stackoverflow.com/a/64488474
    {
      files: ["src/*/**.ts"],
      excludedFiles: ["src/backend/**/*.ts", "src/backend/**/*.tsx"],
      globals: { process: true },
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.json"],
      },
    },
    {
      files: ["src/backend/**/*.ts", "src/backend/**/*.tsx"],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./src/backend/tsconfig.json"],
      },
    },
  ],
};
