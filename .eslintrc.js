module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["eslint:recommended"],
  overrides: [
    {
      files: [".eslintrc.js"],
      env: {
        node: true,
        browser: false,
      },
    },
    {
      files: ["*.ts", "*.tsx"],

      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "plugin:fp-ts/recommended",
        "plugin:fp-ts/recommended-requiring-type-checking",
      ],

      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.json"], // Specify it only for TypeScript files
      },
    },
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "fp-ts", "simple-import-sort"],
  root: true,
  rules: {},
};
