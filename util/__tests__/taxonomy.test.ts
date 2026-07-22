import { resolveTaxonImage, latinPart, iucnColors } from "../taxonomy";

describe("resolveTaxonImage", () => {
  it("returns null when there is no image", () => {
    expect(resolveTaxonImage(null)).toBeNull();
    expect(resolveTaxonImage(undefined)).toBeNull();
    expect(resolveTaxonImage("")).toBeNull();
  });

  it("keeps absolute urls as they are (group lists are serialized by an ImageField)", () => {
    expect(resolveTaxonImage("https://live.staticflickr.com/1/2_c.jpg")).toBe(
      "https://live.staticflickr.com/1/2_c.jpg",
    );
  });

  it("puts server-absolute routes on the api host, not under /media/", () => {
    expect(resolveTaxonImage("/image_taxon/1_879_27921210917_c")).toBe(
      "https://test.local/image_taxon/1_879_27921210917_c",
    );
  });

  it("resolves a stored path against the media host (species rows come from .values())", () => {
    expect(resolveTaxonImage("taxon/1a/2e/27921210917.jpg")).toBe(
      "https://test.local/media/taxon/1a/2e/27921210917.jpg",
    );
  });
});

describe("latinPart", () => {
  it("takes the scientific half of a 'localized / latin' display name", () => {
    expect(latinPart("Osprey / Pandion haliaetus", "Osprey")).toBe(
      "Pandion haliaetus",
    );
  });

  it("returns nothing when the name would only repeat the localized title", () => {
    expect(latinPart("Pandion", "Pandion")).toBe("");
  });

  it("falls back to the whole name when it has no localized half", () => {
    expect(latinPart("Pandionidae", "Ospreys")).toBe("Pandionidae");
  });

  it("handles a missing name", () => {
    expect(latinPart(null, "Osprey")).toBe("");
  });
});

describe("iucnColors", () => {
  it("returns nothing for an unknown or missing category", () => {
    expect(iucnColors(null)).toBeNull();
    expect(iucnColors("XX")).toBeNull();
  });

  it("uses light text on the dark, threatened categories and dark text elsewhere", () => {
    expect(iucnColors("CR")?.text).toBe("#FFFFFF");
    expect(iucnColors("LC")?.text).toBe("#1E2A36");
  });

  it("treats the 'possibly extinct' qualifier as plain CR", () => {
    expect(iucnColors("CR (PE)")).toEqual(iucnColors("CR"));
  });
});
