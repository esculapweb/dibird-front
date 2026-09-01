#!/usr/bin/env node
// Checks the Maestro flows without a device: every `id:` selector must exist in
// the UI code, and every flow must parse.
//
// Why: the two cheapest mistakes to make in a flow are the two most expensive
// to find. A mistyped id and a malformed YAML both surface only when the flow
// is run — after an app launch and a bootstrap, minutes in, and the report then
// blames the step rather than the typo. Both are decidable from the source
// alone, in a second.
//
// What this deliberately does NOT check: text selectors (`tapOn: ".*Delete
// diary.*"`). Those are localised strings matched by regex at runtime; there is
// no static list to check them against, and inventing one would go stale.
//
// Exit code 1 on any unknown id or syntax error, so it can join `npm run check`
// once it is green.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const {
  collectTestIds,
  collectFlowIds,
  flowFiles,
  ROOT,
} = require("./e2e-testids");

const { exact, prefixes, fragments } = collectTestIds();
const exactSet = new Set(exact);

// Ids that belong to the platform rather than to this codebase, so no testID
// will ever back them: React Navigation's iOS back button, the dev-client's own
// settings glyph in common/connect.yaml, and the AOSP autofill dialog that
// Google Password Manager puts over a focused e-mail field (account-emails.yaml
// dismisses it). The last one is a regex because the id on the device is
// `android:id/autofill_dialog_picker` — a full resource id, unlike a testID.
const NATIVE_IDS = new Set([
  "BackButton",
  "gearshape.fill",
  ".*autofill_dialog_picker.*",
]);

// Everything the shared ui primitives can compose: a parent testID with a
// fragment glued on ("sort" + "-option-" -> sort-option-2).
const composed = [];
for (const head of exact) {
  for (const fragment of fragments) composed.push(head + fragment);
}

// Maestro substitutes ${APP_ID} and friends from --env before matching, so an
// id built out of a variable cannot be resolved here. Skipped, not failed.
const isKnown = (id) =>
  id.includes("${") ||
  NATIVE_IDS.has(id) ||
  exactSet.has(id) ||
  prefixes.some((prefix) => id.startsWith(prefix)) ||
  composed.some((head) => id.startsWith(head));

const unknown = collectFlowIds().filter(({ id }) => !isKnown(id));

let failed = false;

if (unknown.length > 0) {
  failed = true;
  console.log(`Unknown id selectors (${unknown.length}):`);
  for (const { id, file, line } of unknown) {
    console.log(`  ${file}:${line}  id: "${id}"`);
  }
  console.log(
    "\nNo testID in screens/components matches these. Check the spelling against `npm run e2e:ids`,",
  );
  console.log(
    "or add the testID to the component if the flow is ahead of the code.",
  );
} else {
  console.log("id selectors: all resolve to a testID in the code.");
}

// A malformed flow is the other mistake that otherwise costs a whole run to
// find. Parsing it here is instant; `maestro check-syntax` understands more (it
// validates commands and fields, not just the YAML) but starts a JVM per file —
// ~1.8s each, a minute for the suite — so it is opt-in via `--syntax` rather
// than paid on every call.
const files = flowFiles();

let yaml = null;
try {
  yaml = require("js-yaml");
} catch {
  console.log("\nSyntax: skipped — js-yaml not installed.");
}

if (yaml) {
  const broken = [];
  for (const file of files) {
    try {
      // loadAll: every flow is two documents, the config header and the steps.
      yaml.loadAll(fs.readFileSync(path.join(ROOT, file), "utf8"));
    } catch (error) {
      broken.push({ file, message: error.message.split("\n")[0] });
    }
  }

  if (broken.length > 0) {
    failed = true;
    console.log(`\nMalformed flows (${broken.length}):`);
    for (const { file, message } of broken) console.log(`  ${file}: ${message}`);
  } else {
    console.log(`\nSyntax: ${files.length} flows parse.`);
  }
}

if (process.argv.includes("--syntax")) {
  console.log("\nRunning maestro check-syntax (one JVM per flow, ~1.8s each)…");
  for (const file of files) {
    try {
      execFileSync("maestro", ["check-syntax", file], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: "1" },
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log("  skipped — maestro not on PATH.");
        break;
      }
      failed = true;
      const detail = ((error.stdout || "") + (error.stderr || ""))
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("WARNING"))
        .join(" ");
      console.log(`  ${file}: ${detail}`);
    }
  }
}

process.exit(failed ? 1 : 0);
