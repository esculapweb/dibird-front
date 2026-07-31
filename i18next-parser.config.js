// Extraction of the localisation keys. The command is `npm run i18n:extract`.
//
// IMPORTANT: the extractor here only ADDS keys, it never removes them
// (`keepRemoved`) and keeps no archive (`createOldCatalogs`). This is not
// caution but a fix for three different ways in which the default settings used
// to corrupt `locales/*.json` (see CLAUDE.md, the i18n section):
//
// 1. The extractor only sees literal `t("...")`. A key assembled at runtime
//    (`t(RANK_TITLE_KEY[rank])`, a key from a backend response) does not exist
//    for it, and with `keepRemoved: false` it silently moved to the archive —
//    that is, disappeared from the app. Comment lists under such keys softened
//    that, but relied on nobody forgetting about them.
// 2. The archived `*_old.json` was merged back over the live translation: on
//    every run the parser does mergeHashes(archive → new catalogue), and for a
//    key present in both the archived value wins. That is how `no_species_found`
//    in `en.json` turned into an empty string — and an empty string is a valid
//    translation, it beats the fallback, leaving the UI blank.
// 3. An archived key shaped like `<live_key>_<something>` came back whole: the
//    context separator in i18next is the same `_`, so a dead `found_today` next
//    to a live `found` was recognised as "found in the today context" and
//    returned to the catalogue.
//
// The price of the solution: unused keys now accumulate instead of disappearing
// on their own. It is a deliberate trade-off — losing a live translation is
// worse than carrying a spare one. To find what has accumulated:
// `npm run i18n:unused` (changes nothing, only prints).
module.exports = {
  locales: ['en', 'ru'],
  output: 'locales/$LOCALE.json',
  input: [
    'components/**/*.{js,ts,jsx,tsx}',
    'hooks/**/*.{js,ts,jsx,tsx}',
    'navigation/**/*.{js,ts,jsx,tsx}',
    'screens/**/*.{js,ts,jsx,tsx}',
    'services/**/*.{js,ts,jsx,tsx}',
    'store/**/*.{js,ts,jsx,tsx}',
    'util/**/*.{js,ts,jsx,tsx}'
  ],
  // Never remove anything from the catalogue — reasons 1 and 3 above.
  keepRemoved: true,
  // Do not create `locales/*_old.json` — reasons 2 and 3 above. The files are
  // deleted from the repository; without this flag the next run would recreate
  // them.
  createOldCatalogs: false,
  sort: true,
  verbose: true,
  lexers: {
    js: ['JavascriptLexer'],
    ts: ['JavascriptLexer'],
    jsx: ['JsxLexer'],
    tsx: ['JsxLexer']
  }
};
