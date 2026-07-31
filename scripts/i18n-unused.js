#!/usr/bin/env node
// Prints the localisation keys the extractor did not find in the code. Changes
// nothing — deleting them stays a manual decision.
//
// Why a separate command: `i18next-parser.config.js` deliberately never removes
// keys (what that used to end in is described there), so dead keys no longer
// disappear on their own. Here they are visible, but the decision is made by a
// human.
//
// It counts with the same parser and the same config as `npm run i18n:extract`
// rather than with a grep of its own: the parser sees `t()` in comments too, and
// that is exactly how the runtime-assembled keys are declared in this project
// (`// t("country_status_endemic")` — see CLAUDE.md). A homemade search over the
// calls would not see them and would declare them dead — precisely the mistake
// that used to lose the translations.

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const base = require(path.join(root, "i18next-parser.config.js"));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-unused-"));
const configPath = path.join(tmp, "config.js");

// The same config, but with the protections off and the output aside: what is
// needed here is exactly the "clean" result of the extraction, to compare the
// working catalogue against it.
fs.writeFileSync(
  configPath,
  `module.exports = ${JSON.stringify(
    {
      ...base,
      input: base.input.map((pattern) => path.join(root, pattern)),
      output: path.join(tmp, "$LOCALE.json"),
      keepRemoved: false,
      createOldCatalogs: false,
      verbose: false,
    },
    null,
    2,
  )};\n`,
);

try {
  execFileSync("npx", ["i18next", "-c", configPath], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
  });

  let total = 0;

  for (const locale of base.locales) {
    const livePath = path.join(root, `locales/${locale}.json`);
    const freshPath = path.join(tmp, `${locale}.json`);

    if (!fs.existsSync(freshPath)) {
      console.error(`The extractor did not create ${freshPath} — check the config.`);
      process.exitCode = 1;
      continue;
    }

    const live = Object.keys(JSON.parse(fs.readFileSync(livePath, "utf8")));
    const found = new Set(
      Object.keys(JSON.parse(fs.readFileSync(freshPath, "utf8"))),
    );
    const unused = live.filter((key) => !found.has(key));
    total += unused.length;

    console.log(`\n${locale}: ${unused.length} keys not found in the code`);
    unused.forEach((key) => console.log(`  ${key}`));
  }

  if (total === 0) console.log("\nNo spare keys.");
  else
    console.log(
      "\nBefore deleting: a key may be assembled at runtime. Then it is not dead —\n" +
        "it is missing a comment list `// t(\"...\")` next to the place where it is\n" +
        "resolved (see CLAUDE.md).",
    );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
