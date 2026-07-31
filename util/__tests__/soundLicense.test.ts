import { parseSoundLicense, xenoCantoUrl } from "../soundLicense";

describe("parseSoundLicense", () => {
  it("parses a protocol-relative CC link from xeno-canto", () => {
    expect(
      parseSoundLicense("//creativecommons.org/licenses/by-nc-sa/4.0/"),
    ).toEqual({
      label: "CC BY-NC-SA 4.0",
      url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    });
  });

  it("upgrades http to https", () => {
    expect(
      parseSoundLicense("http://creativecommons.org/licenses/by/3.0/"),
    ).toEqual({
      label: "CC BY 3.0",
      url: "https://creativecommons.org/licenses/by/3.0/",
    });
  });

  it("names public domain separately", () => {
    expect(
      parseSoundLicense("//creativecommons.org/publicdomain/zero/1.0/"),
    ).toEqual({
      label: "CC0 1.0",
      url: "https://creativecommons.org/publicdomain/zero/1.0/",
    });
    expect(
      parseSoundLicense("//creativecommons.org/publicdomain/mark/1.0/"),
    ).toEqual({
      label: "Public Domain Mark 1.0",
      url: "https://creativecommons.org/publicdomain/mark/1.0/",
    });
  });

  it("shows a ready-made label as is and without a link", () => {
    expect(parseSoundLicense("CC BY")).toEqual({ label: "CC BY", url: null });
  });

  it("leaves an unknown link as its own label", () => {
    expect(parseSoundLicense("https://example.org/lic")).toEqual({
      label: "https://example.org/lic",
      url: "https://example.org/lic",
    });
  });

  it("treats an empty value as no licence", () => {
    expect(parseSoundLicense(null)).toBeNull();
    expect(parseSoundLicense(undefined)).toBeNull();
    expect(parseSoundLicense("   ")).toBeNull();
  });
});

describe("xenoCantoUrl", () => {
  it("points at the recording's page, not at the download", () => {
    expect(xenoCantoUrl(363809)).toBe("https://xeno-canto.org/363809");
  });
});
