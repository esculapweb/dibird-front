const tseslint = require("@typescript-eslint/eslint-plugin");
const parser = require("@typescript-eslint/parser");

module.exports = tseslint.config(...tseslint.configs.recommended);
