#!/usr/bin/env node
// Fails if a catalogue holds an empty translation. Prints the offending keys and
// exits non-zero — this one is a gate, unlike `npm run i18n:unused`.
//
// Why it is worth a gate: an empty string is a valid translation, so i18next
// stops falling back and renders nothing at all. The result is a blank label in
// the UI, which no type check and no test notices (see CLAUDE.md).
//
// Where empty values come from: `npm run i18n:extract` adds a newly seen key to
// every catalogue with an empty value, and the plural forms of an existing key
// the same way — the translation is expected to be filled in by hand right
// after, and that is exactly the step that gets forgotten.
//
// Locales are taken from `i18next-parser.config.js` so that a new one is covered
// the moment it is added to the extractor.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const { locales } = require(path.join(root, "i18next-parser.config.js"));

let total = 0;

for (const locale of locales) {
  const file = `locales/${locale}.json`;
  const catalogue = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

  // Whitespace-only counts as empty too: it wins over the fallback just the same
  // and shows up as a blank in the UI.
  const empty = Object.entries(catalogue)
    .filter(([, value]) => typeof value === "string" && value.trim() === "")
    .map(([key]) => key);

  total += empty.length;

  if (empty.length > 0) {
    console.error(`\n${file}: ${empty.length} empty value(s)`);
    empty.forEach((key) => console.error(`  ${key}`));
  }
}

if (total > 0) {
  console.error(
    "\nAn empty string is a valid translation and beats the fallback — fill these\n" +
      "in or delete the key. For a plural key, all CLDR forms of the language are\n" +
      "required (see CLAUDE.md).",
  );
  process.exit(1);
}

console.log(`No empty values in ${locales.join(", ")}.`);
