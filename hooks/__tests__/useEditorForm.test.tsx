jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { setSession } from "../../util/sessionStore";
import { toDateOnly } from "../../util/helpers";
import { useEditorForm } from "../useEditorForm";

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setSession("lastDate", null);
});

afterEach(() => {
  queryClient.clear();
});

describe("initial territory/place/species resolution", () => {
  it("falls back to the given defaults when there's no item", async () => {
    const { result } = await renderHook(
      () =>
        useEditorForm({
          item: null,
          defaultTerritory: 5,
          defaultPlace: 2,
          defaultSpecies: 9,
          hasSpecies: true,
        }),
      { wrapper },
    );

    expect(result.current.territoryValue).toBe(5);
    expect(result.current.placeValue).toBe(2);
    expect(result.current.speciesValue).toBe(9);
  });

  it("ignores defaultSpecies when hasSpecies is false", async () => {
    const { result } = await renderHook(
      () => useEditorForm({ item: null, defaultSpecies: 9, hasSpecies: false }),
      { wrapper },
    );
    expect(result.current.speciesValue).toBeNull();
  });

  it("prefers the item's own territory/place/species over the defaults", async () => {
    const item = {
      territory: 7,
      place: 3,
      species: 11,
      species_data: { id: 99, name: "x", name_lang: "x" },
    };
    const { result } = await renderHook(
      () =>
        useEditorForm({
          item: item as never,
          defaultTerritory: 5,
          defaultPlace: 2,
          defaultSpecies: 9,
          hasSpecies: true,
        }),
      { wrapper },
    );

    expect(result.current.territoryValue).toBe(7);
    expect(result.current.placeValue).toBe(3);
    expect(result.current.speciesValue).toBe(11);
  });

  it("falls back to territory_data/place_data ids when the plain fields are absent", async () => {
    const item = {
      territory_data: { id: 42, code: "FR", name: "France" },
      place_data: { id: 24, name: "Park" },
    };
    const { result } = await renderHook(() => useEditorForm({ item: item as never }), { wrapper });

    expect(result.current.territoryValue).toBe(42);
    expect(result.current.placeValue).toBe(24);
  });
});

describe("formData initial date", () => {
  it("uses the item's own date when editing an existing item", async () => {
    const item = { date_time: "2026-03-01T10:00:00Z" };
    const { result } = await renderHook(() => useEditorForm({ item: item as never }), { wrapper });
    expect(result.current.formData.date_time).toBe(toDateOnly("2026-03-01T10:00:00Z"));
  });

  it("falls back to the last-used session date when creating a new item", async () => {
    setSession("lastDate", "2026-01-15");
    const { result } = await renderHook(() => useEditorForm({ item: null }), { wrapper });
    expect(result.current.formData.date_time).toBe("2026-01-15");
  });

  it("falls back to today when there's neither an item nor a session date", async () => {
    const { result } = await renderHook(() => useEditorForm({ item: null }), { wrapper });
    expect(result.current.formData.date_time).toBe(toDateOnly(new Date()));
  });
});

describe("formData other fields", () => {
  it("seeds private from the item, falling back to the profile's private_diary default", async () => {
    const { result: fromProfile } = await renderHook(
      () => useEditorForm({ item: null, profile: { private_diary: true } as never }),
      { wrapper },
    );
    expect(fromProfile.current.formData.private).toBe(true);

    const { result: fromItem } = await renderHook(
      () =>
        useEditorForm({
          item: { private: false } as never,
          profile: { private_diary: true } as never,
        }),
      { wrapper },
    );
    expect(fromItem.current.formData.private).toBe(false);
  });

  it("defaults location_private to true when the item doesn't specify it", async () => {
    const { result } = await renderHook(() => useEditorForm({ item: null }), { wrapper });
    expect(result.current.formData.location_private).toBe(true);
  });

  it("carries diaryId into formData.diary", async () => {
    const { result } = await renderHook(() => useEditorForm({ item: null, diaryId: 7 }), { wrapper });
    expect(result.current.formData.diary).toBe(7);
  });

  it("omits species from formData entirely when hasSpecies is false", async () => {
    const { result } = await renderHook(
      () => useEditorForm({ item: null, hasSpecies: false, defaultSpecies: 9 }),
      { wrapper },
    );
    expect(result.current.formData).not.toHaveProperty("species");
  });
});

describe("speciesData/placeData seeding", () => {
  it("derives speciesData/placeData from the item's nested detail objects", async () => {
    const item = {
      species_data: { id: 11, name: "Turdus merula", name_lang: "Blackbird", segment: "blackbird", thumb: "t.jpg" },
      place_data: { id: 3, name: "City Park", preview: "p.jpg", location: { lat: 1, lng: 2 } },
    };
    const { result } = await renderHook(() => useEditorForm({ item: item as never }), { wrapper });

    expect(result.current.speciesData).toEqual({
      value: 11,
      label: "Blackbird",
      name: "Turdus merula",
      name_lang: "Blackbird",
      segment: "blackbird",
      thumb: "t.jpg",
    });
    expect(result.current.placeData).toEqual({
      value: 3,
      label: "City Park",
      name: "City Park",
      preview: "p.jpg",
      location: { lat: 1, lng: 2 },
    });
  });

  it("looks up a matching SpeciesDropdown cache entry when speciesValue has no seeded speciesData", async () => {
    queryClient.setQueryData(["SpeciesDropdown", "territory:5"], [
      { value: 9, label: "Robin", name: "Erithacus rubecula", name_lang: "Robin", segment: "robin" },
    ]);
    const { result } = await renderHook(
      () => useEditorForm({ item: null, defaultSpecies: 9, hasSpecies: true }),
      { wrapper },
    );

    await act(async () => {});
    expect(result.current.speciesData).toEqual(
      expect.objectContaining({ value: 9, label: "Robin" }),
    );
  });

  it("leaves speciesData null when no cache entry matches speciesValue", async () => {
    queryClient.setQueryData(["SpeciesDropdown", "territory:5"], [{ value: 1, label: "Other" }]);
    const { result } = await renderHook(
      () => useEditorForm({ item: null, defaultSpecies: 9, hasSpecies: true }),
      { wrapper },
    );

    await act(async () => {});
    expect(result.current.speciesData).toBeNull();
  });

  it("looks up a matching PlacesDropdown cache entry when placeValue has no seeded placeData", async () => {
    queryClient.setQueryData(["PlacesDropdown", "territory:5"], [
      { value: 2, label: "City Park", name: "City Park" },
    ]);
    const { result } = await renderHook(() => useEditorForm({ item: null, defaultPlace: 2 }), { wrapper });

    await act(async () => {});
    expect(result.current.placeData).toEqual(expect.objectContaining({ value: 2, label: "City Park" }));
  });
});

describe("validateForm", () => {
  it("only flags fields actually listed in requiredFields", async () => {
    const { result } = await renderHook(
      () => useEditorForm({ item: null, requiredFields: ["territory"] }),
      { wrapper },
    );

    let valid = true;
    await act(async () => {
      valid = result.current.validateForm();
    });
    expect(valid).toBe(false);
    expect(result.current.errors).toEqual({ territory: "territory_required" });
  });

  it("passes once all required fields are filled", async () => {
    const { result } = await renderHook(
      () => useEditorForm({ item: null, requiredFields: ["territory", "species"], hasSpecies: true }),
      { wrapper },
    );

    await act(async () => {
      result.current.setTerritoryValue(5);
      result.current.setSpeciesValue(9);
    });

    let valid = false;
    await act(async () => {
      valid = result.current.validateForm();
    });
    expect(valid).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it("flags a missing date_time when required", async () => {
    const { result } = await renderHook(
      () => useEditorForm({ item: null, requiredFields: ["date_time"] }),
      { wrapper },
    );

    await act(async () => {
      result.current.setFormData((prev) => ({ ...prev, date_time: null }));
    });

    let valid = true;
    await act(async () => {
      valid = result.current.validateForm();
    });
    expect(valid).toBe(false);
    expect(result.current.errors).toEqual({ date_time: "date_required" });
  });
});
