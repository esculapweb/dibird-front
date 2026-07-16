jest.mock("../../util/storageHelper", () => ({
  loadGlobalTerritory: jest.fn(),
  saveGlobalTerritory: jest.fn(),
  loadGlobalDateFilter: jest.fn(),
  saveGlobalDateFilter: jest.fn(),
  loadGlobalPlace: jest.fn(),
  saveGlobalPlace: jest.fn(),
  loadGlobalSpecies: jest.fn(),
  saveGlobalSpecies: jest.fn(),
  clearAllGlobalFilters: jest.fn(),
}));
jest.mock("../profile-context", () => ({ registerOnProfileSaved: jest.fn() }));

import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as storageHelper from "../../util/storageHelper";
import { registerOnProfileSaved } from "../profile-context";
import { FiltersProvider, useFilters } from "../filters-context";

const mockUnregister = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (storageHelper.loadGlobalTerritory as jest.Mock).mockResolvedValue(null);
  (storageHelper.loadGlobalDateFilter as jest.Mock).mockResolvedValue(null);
  (storageHelper.loadGlobalPlace as jest.Mock).mockResolvedValue(null);
  (storageHelper.loadGlobalSpecies as jest.Mock).mockResolvedValue(null);
  (registerOnProfileSaved as jest.Mock).mockReturnValue(mockUnregister);
});

describe("initial load", () => {
  it("loads persisted values and flips filtersReady once done", async () => {
    (storageHelper.loadGlobalTerritory as jest.Mock).mockResolvedValue(5);
    (storageHelper.loadGlobalDateFilter as jest.Mock).mockResolvedValue({ type: "today" });
    (storageHelper.loadGlobalPlace as jest.Mock).mockResolvedValue(2);
    (storageHelper.loadGlobalSpecies as jest.Mock).mockResolvedValue(9);

    const { result } = await renderHook(() => useFilters(), { wrapper: FiltersProvider });

    await waitFor(() => expect(result.current.filtersReady).toBe(true));
    expect(result.current.territory).toBe(5);
    expect(result.current.date).toEqual({ type: "today" });
    expect(result.current.place).toBe(2);
    expect(result.current.species).toBe(9);
  });

  it("defaults seenMode to 'all' when a territory was persisted", async () => {
    (storageHelper.loadGlobalTerritory as jest.Mock).mockResolvedValue(5);
    const { result } = await renderHook(() => useFilters(), { wrapper: FiltersProvider });
    await waitFor(() => expect(result.current.filtersReady).toBe(true));
    expect(result.current.seenMode).toBe("all");
  });

  it("defaults seenMode to 'seen' when there's no persisted territory", async () => {
    const { result } = await renderHook(() => useFilters(), { wrapper: FiltersProvider });
    await waitFor(() => expect(result.current.filtersReady).toBe(true));
    expect(result.current.seenMode).toBe("seen");
  });
});

describe("setTerritory", () => {
  it("persists the new territory without touching the place when set to a real value", async () => {
    const { result } = await renderHook(() => useFilters(), { wrapper: FiltersProvider });
    await waitFor(() => expect(result.current.filtersReady).toBe(true));

    await act(async () => {
      await result.current.setTerritory(7);
    });

    expect(result.current.territory).toBe(7);
    expect(storageHelper.saveGlobalTerritory).toHaveBeenCalledWith(7);
    expect(storageHelper.saveGlobalPlace).not.toHaveBeenCalled();
  });

  it("clears the place along with the territory when set to null", async () => {
    (storageHelper.loadGlobalPlace as jest.Mock).mockResolvedValue(2);
    const { result } = await renderHook(() => useFilters(), { wrapper: FiltersProvider });
    await waitFor(() => expect(result.current.place).toBe(2));

    await act(async () => {
      await result.current.setTerritory(null);
    });

    expect(result.current.territory).toBeNull();
    expect(result.current.place).toBeNull();
    expect(storageHelper.saveGlobalPlace).toHaveBeenCalledWith(null);
    expect(storageHelper.saveGlobalTerritory).toHaveBeenCalledWith(null);
  });
});

describe("setDate/setPlace/setSpecies", () => {
  it("update state and persist independently", async () => {
    const { result } = await renderHook(() => useFilters(), { wrapper: FiltersProvider });
    await waitFor(() => expect(result.current.filtersReady).toBe(true));

    await act(async () => {
      await result.current.setDate({ type: "this_year" });
      await result.current.setPlace(3);
      await result.current.setSpecies(11);
    });

    expect(result.current.date).toEqual({ type: "this_year" });
    expect(result.current.place).toBe(3);
    expect(result.current.species).toBe(11);
    expect(storageHelper.saveGlobalDateFilter).toHaveBeenCalledWith({ type: "this_year" });
    expect(storageHelper.saveGlobalPlace).toHaveBeenCalledWith(3);
    expect(storageHelper.saveGlobalSpecies).toHaveBeenCalledWith(11);
  });
});

describe("resetFilters", () => {
  it("clears all persisted filters and local state, but leaves seenMode untouched", async () => {
    (storageHelper.loadGlobalTerritory as jest.Mock).mockResolvedValue(5);
    const { result } = await renderHook(() => useFilters(), { wrapper: FiltersProvider });
    await waitFor(() => expect(result.current.territory).toBe(5));
    expect(result.current.seenMode).toBe("all");

    await act(async () => {
      await result.current.resetFilters();
    });

    expect(storageHelper.clearAllGlobalFilters).toHaveBeenCalledTimes(1);
    expect(result.current.territory).toBeNull();
    expect(result.current.date).toBeNull();
    expect(result.current.place).toBeNull();
    expect(result.current.species).toBeNull();
    expect(result.current.seenMode).toBe("all");
  });
});

describe("reload", () => {
  it("re-fetches every persisted filter and updates state", async () => {
    const { result } = await renderHook(() => useFilters(), { wrapper: FiltersProvider });
    await waitFor(() => expect(result.current.filtersReady).toBe(true));

    (storageHelper.loadGlobalTerritory as jest.Mock).mockResolvedValue(9);
    (storageHelper.loadGlobalPlace as jest.Mock).mockResolvedValue(4);

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.territory).toBe(9);
    expect(result.current.place).toBe(4);
  });
});

describe("profile-saved subscription", () => {
  it("registers a reload on mount and unregisters it on unmount", async () => {
    const { unmount } = await renderHook(() => useFilters(), { wrapper: FiltersProvider });
    expect(registerOnProfileSaved).toHaveBeenCalledWith(expect.any(Function));

    await unmount();
    expect(mockUnregister).toHaveBeenCalledTimes(1);
  });

  it("reloads filters when a profile-saved event fires", async () => {
    const { result } = await renderHook(() => useFilters(), { wrapper: FiltersProvider });
    await waitFor(() => expect(result.current.filtersReady).toBe(true));

    (storageHelper.loadGlobalTerritory as jest.Mock).mockResolvedValue(3);
    const onProfileSaved = (registerOnProfileSaved as jest.Mock).mock.calls[0][0];
    await act(async () => {
      await onProfileSaved();
    });

    expect(result.current.territory).toBe(3);
  });
});
