#!/usr/bin/env node
// Печатает ключи локализации, которых экстрактор не нашёл в коде. Ничего не
// меняет — удаление остаётся ручным решением.
//
// Зачем отдельная команда: `i18next-parser.config.js` намеренно не удаляет
// ключи (там же расписано, чем это кончалось), поэтому мёртвые ключи больше не
// исчезают сами. Здесь они видны, но решение принимает человек.
//
// Считает тем же парсером и тем же конфигом, что и `npm run i18n:extract`,
// а не собственным grep'ом: парсер видит `t()` в том числе в комментариях, и
// именно так в этом проекте объявлены ключи, собираемые в рантайме
// (`// t("country_status_endemic")` — см. CLAUDE.md). Самодельный поиск по
// вызовам их бы не увидел и объявил мёртвыми — ровно та ошибка, из-за которой
// переводы и терялись.

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const base = require(path.join(root, "i18next-parser.config.js"));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-unused-"));
const configPath = path.join(tmp, "config.js");

// Тот же конфиг, но со снятыми защитами и выводом в сторону: нам нужен именно
// «чистый» результат извлечения, чтобы сравнить с ним рабочий каталог.
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
      console.error(`Экстрактор не создал ${freshPath} — проверьте конфиг.`);
      process.exitCode = 1;
      continue;
    }

    const live = Object.keys(JSON.parse(fs.readFileSync(livePath, "utf8")));
    const found = new Set(
      Object.keys(JSON.parse(fs.readFileSync(freshPath, "utf8"))),
    );
    const unused = live.filter((key) => !found.has(key));
    total += unused.length;

    console.log(`\n${locale}: ${unused.length} ключей не найдено в коде`);
    unused.forEach((key) => console.log(`  ${key}`));
  }

  if (total === 0) console.log("\nЛишних ключей нет.");
  else
    console.log(
      "\nПрежде чем удалять: ключ мог собираться в рантайме. Тогда он не мёртв —\n" +
        "ему не хватает комментария-списка `// t(\"...\")` рядом с местом, где он\n" +
        "резолвится (см. CLAUDE.md).",
    );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
