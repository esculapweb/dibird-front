// Лицензия записи приходит из xeno-canto как есть — в поле `lic` их API лежит
// протокол-относительный URL вида `//creativecommons.org/licenses/by-nc-sa/4.0/`
// (бэк только пересылает его, см. `parsers/management/commands/xeno.py`).
// Показывать пользователю такую строку нельзя, а не показывать вовсе —
// нарушение самих CC-лицензий: они требуют указать не только автора, но и
// лицензию со ссылкой на неё.
//
// Значение бывает и пустым (`license__isnull` — записи, для которых команда
// `xeno --license` ещё не отработала или API не отдал поле), и нераспознанным:
// в таком случае отдаём его как есть без ссылки, но не прячем.

export interface SoundLicense {
  /** Короткая метка для UI: `CC BY-NC-SA 4.0`, `CC0 1.0`. */
  label: string;
  /** Ссылка на текст лицензии; null, если строку не удалось разобрать. */
  url: string | null;
}

// `//creativecommons.org/...` — валидный URL только внутри страницы; в
// Linking.openURL такой уедет без схемы и не откроется.
const withScheme = (raw: string) =>
  raw.startsWith("//") ? `https:${raw}` : raw.replace(/^http:/, "https:");

const LICENSE_RE = /creativecommons\.org\/licenses\/([a-z-]+)\/([\d.]+)/i;
const PUBLIC_DOMAIN_RE = /creativecommons\.org\/publicdomain\/(zero|mark)\/([\d.]+)/i;

export const parseSoundLicense = (
  raw: string | null | undefined,
): SoundLicense | null => {
  const value = raw?.trim();
  if (!value) return null;

  const cc = value.match(LICENSE_RE);
  if (cc) {
    return {
      label: `CC ${cc[1].toUpperCase()} ${cc[2]}`,
      url: withScheme(value),
    };
  }

  const publicDomain = value.match(PUBLIC_DOMAIN_RE);
  if (publicDomain) {
    const label =
      publicDomain[1].toLowerCase() === "zero"
        ? `CC0 ${publicDomain[2]}`
        : `Public Domain Mark ${publicDomain[2]}`;
    return { label, url: withScheme(value) };
  }

  // Не CC-ссылка: в базе встречаются и готовые метки (`CC BY`). Ссылку даём
  // только если это вообще ссылка, иначе openURL упадёт на «CC BY».
  const isUrl = /^(https?:)?\/\//i.test(value);
  return { label: value, url: isUrl ? withScheme(value) : null };
};

/** Страница записи на xeno-canto — источник, который требует указать CC BY. */
export const xenoCantoUrl = (xenoId: number) =>
  `https://xeno-canto.org/${xenoId}`;
