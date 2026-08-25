// Shared scanner behind `npm run e2e:ids` and `npm run e2e:lint`: the set of
// testIDs the UI code exposes, and the ids the Maestro flows ask for.
//
// A regex scan rather than a real parse. That is enough here because testID is
// always written as a literal attribute in this codebase — and the cost of
// being wrong is low in the direction that matters: an id the scan misses shows
// up as a lint complaint about a flow that actually works, never as a silent
// pass for a flow that does not.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Where testIDs live. `components/ui` holds the shared primitives that pass a
// testID straight through to the native view, so it carries the prefixes.
const SOURCE_DIRS = ["screens", "components", "navigation"];
const FLOW_DIR = ".maestro";

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

const walk = (dir, extensions, out = []) => {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return out;

  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // __tests__ carries testIDs of its own — fixtures and render helpers that
      // no flow can ever tap. Counting them would let a typo in a real screen
      // hide behind a same-named test fixture.
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      walk(relative, extensions, out);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(relative);
    }
  }
  return out;
};

// The value side of a `testID` — everything the id could evaluate to. Four
// spellings are in use and all four have to be read, which is why this is a
// small scanner rather than one regex:
//   testID="diary-save-button"                          a plain attribute
//   testID: "diary-save-button"                         an object property
//                                                       (DiaryEditorScreen)
//   testID={isLogin ? "login-..." : "signup-..."}       a conditional
//                                                       (AuthForm)
//   testID={`section-${sec.key}`}                       an interpolation
// Taking the rest of the line instead would sweep in neighbouring props
// (accessibilityLabel and friends) and quietly widen the vocabulary the linter
// accepts.
const readValue = (source, start) => {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) i += 1;

  const open = source[i];
  if (open === '"' || open === "'" || open === "`") {
    const end = source.indexOf(open, i + 1);
    return end === -1 ? "" : source.slice(i, end + 1);
  }

  if (open === "{") {
    // Balanced, so `${...}` inside a template does not end the expression early.
    let depth = 0;
    for (let j = i; j < source.length; j += 1) {
      if (source[j] === "{") depth += 1;
      else if (source[j] === "}") {
        depth -= 1;
        if (depth === 0) return source.slice(i + 1, j);
      }
    }
    return "";
  }

  // An object property: up to the comma or the end of the line.
  const rest = source.slice(i);
  const end = rest.search(/[,\n]/);
  return end === -1 ? rest : rest.slice(0, end);
};

const collectTestIds = () => {
  const exact = new Set();
  const prefixes = new Set();
  const fragments = new Set();

  for (const dir of SOURCE_DIRS) {
    for (const file of walk(dir, SOURCE_EXTENSIONS)) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");

      for (const match of source.matchAll(/\btestID\s*[:=]/g)) {
        const value = readValue(source, match.index + match[0].length);
        if (!value) continue;

        for (const literal of value.matchAll(/"([^"]+)"|'([^']+)'/g)) {
          exact.add(literal[1] ?? literal[2]);
        }

        for (const template of value.matchAll(/`([^`]*)`/g)) {
          const body = template[1];
          const interpolation = body.indexOf("${");

          if (interpolation === -1) {
            if (body) exact.add(body);
          } else if (interpolation > 0) {
            // `section-${sec.key}` -> the static head, "section-".
            prefixes.add(body.slice(0, interpolation));
          } else {
            // A template that *starts* with an interpolation is the shared-ui
            // composition pattern: `${testID}-option-${index}` in RadioGroup,
            // `${testID}-toggle-visibility` in Input. The id a flow sees is the
            // parent's own testID with this glued on ("sort" + "-option-" ->
            // sort-option-2), so what is reusable here is the static fragment.
            const parts = body.split(/\$\{[^}]*\}/);
            const fragment = parts.find((part) => part !== "");
            if (fragment) fragments.add(fragment);
          }
        }
      }
    }
  }

  return {
    exact: [...exact].sort(),
    prefixes: [...prefixes].sort(),
    fragments: [...fragments].sort(),
  };
};

// Every `id:` a flow asks for, with the file and line, so a complaint points at
// the place to fix. Covers both spellings the flows use:
//   - tapOn: { id: "foo" }
//   - element: { id: "foo" }  (inside scrollUntilVisible / extendedWaitUntil)
// which are the same `id:` key at different nesting depths — hence a line scan
// rather than a YAML walk.
const flowFiles = () => walk(FLOW_DIR, [".yaml", ".yml"]);

const collectFlowIds = () => {
  const found = [];

  for (const file of flowFiles()) {
    const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n");

    lines.forEach((line, index) => {
      if (/^\s*#/.test(line)) return;
      const match = line.match(/(?:^|[\s{,])id:\s*["']?([^"'#,}\s]+)["']?/);
      if (!match) return;
      found.push({ id: match[1], file, line: index + 1 });
    });
  }

  return found;
};

module.exports = {
  collectTestIds,
  collectFlowIds,
  flowFiles,
  SOURCE_DIRS,
  FLOW_DIR,
  ROOT,
};
