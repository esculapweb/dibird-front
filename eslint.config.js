const parser = require("@typescript-eslint/parser");
const tseslint = require("@typescript-eslint/eslint-plugin");
const jest = require("eslint-plugin-jest");

module.exports = [
  { ignores: ["coverage/"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    plugins: { jest },
    languageOptions: { globals: jest.environments.globals.globals },
    rules: {
      ...jest.configs.recommended.rules,
    },
  },
];
