#!/usr/bin/env node
// Prints every testID the UI code exposes, which is the vocabulary Maestro
// flows are allowed to use in an `id:` selector. Changes nothing.
//
// Why: a selector invented from a screenshot is only discovered to be wrong by
// running the flow — a full app launch and bootstrap, ~90s, to learn about a
// typo. This is the same lookup in a second. `.maestro/ui.sh` answers the
// neighbouring question (what is on screen *right now*); this one answers what
// exists in the code at all.
//
// Two kinds come out of the scan, because both are used in flows:
//   exact     testID="diary-save-button"
//   prefix    testID={`section-${sec.key}`}  ->  section-*
// A prefix is everything before the first interpolation. `section-Observations`
// is a real, tappable id even though that exact string appears nowhere in the
// code — which is why the linter cannot simply demand exact matches.

const { collectTestIds, SOURCE_DIRS } = require("./e2e-testids");

const { exact, prefixes } = collectTestIds();

console.log(`Exact testIDs (${exact.length}):`);
for (const id of exact) console.log(`  ${id}`);

console.log(`\nPrefixes from interpolated testIDs (${prefixes.length}):`);
for (const prefix of prefixes) console.log(`  ${prefix}*`);

console.log(`\nScanned: ${SOURCE_DIRS.join(", ")}`);
