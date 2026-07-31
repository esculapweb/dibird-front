import { parseSoundLicense, xenoCantoUrl } from "../soundLicense";

describe("parseSoundLicense", () => {
  it("разбирает протокол-относительную CC-ссылку из xeno-canto", () => {
    expect(
      parseSoundLicense("//creativecommons.org/licenses/by-nc-sa/4.0/"),
    ).toEqual({
      label: "CC BY-NC-SA 4.0",
      url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    });
  });

  it("поднимает http до https", () => {
    expect(
      parseSoundLicense("http://creativecommons.org/licenses/by/3.0/"),
    ).toEqual({
      label: "CC BY 3.0",
      url: "https://creativecommons.org/licenses/by/3.0/",
    });
  });

  it("отдельно называет public domain", () => {
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

  it("готовую метку показывает как есть и без ссылки", () => {
    expect(parseSoundLicense("CC BY")).toEqual({ label: "CC BY", url: null });
  });

  it("неизвестной ссылке оставляет саму ссылку", () => {
    expect(parseSoundLicense("https://example.org/lic")).toEqual({
      label: "https://example.org/lic",
      url: "https://example.org/lic",
    });
  });

  it("пустое значение — не лицензия", () => {
    expect(parseSoundLicense(null)).toBeNull();
    expect(parseSoundLicense(undefined)).toBeNull();
    expect(parseSoundLicense("   ")).toBeNull();
  });
});

describe("xenoCantoUrl", () => {
  it("ведёт на страницу записи, а не на скачивание", () => {
    expect(xenoCantoUrl(363809)).toBe("https://xeno-canto.org/363809");
  });
});
