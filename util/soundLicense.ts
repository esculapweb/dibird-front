// The licence of a recording comes from xeno-canto as is — the `lic` field of
// their API holds a protocol-relative URL like
// `//creativecommons.org/licenses/by-nc-sa/4.0/` (the backend only forwards it,
// see `parsers/management/commands/xeno.py`). Such a string must not be shown to
// the user, and not showing it at all violates the CC licences themselves: they
// require naming not only the author but also the licence, with a link to it.
//
// The value is sometimes empty (`license__isnull` — recordings for which the
// `xeno --license` command has not run yet, or the API did not return the field)
// and sometimes unrecognised: in that case we return it as is without a link, but
// do not hide it.

export interface SoundLicense {
  /** A short label for the UI: `CC BY-NC-SA 4.0`, `CC0 1.0`. */
  label: string;
  /** A link to the text of the licence; null if the string could not be parsed. */
  url: string | null;
}

// `//creativecommons.org/...` is a valid URL only inside a page; in
// Linking.openURL it would go without a scheme and would not open.
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

  // Not a CC link: the database also holds ready-made labels (`CC BY`). A link is
  // given only if it is a link at all, otherwise openURL would fail on "CC BY".
  const isUrl = /^(https?:)?\/\//i.test(value);
  return { label: value, url: isUrl ? withScheme(value) : null };
};

/** The recording's page on xeno-canto — the source that requires a CC BY credit. */
export const xenoCantoUrl = (xenoId: number) =>
  `https://xeno-canto.org/${xenoId}`;
