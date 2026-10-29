jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../util/storageHelper", () => ({
  loadViewMode: jest.fn(),
  saveViewMode: jest.fn(),
}));

import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useSpeciesViewMode } from "../useSpeciesViewMode";
import { loadViewMode, saveViewMode } from "../../util/storageHelper";

const mockLoad = loadViewMode as jest.Mock;

/** What storage holds, by key; anything absent reads as null. */
const stored = (values: Record<string, unknown>) =>
  mockLoad.mockImplementation((key: string) =>
    Promise.resolve(values[key] ?? null),
  );

const renderReady = async () => {
  const hook = await renderHook(() => useSpeciesViewMode());
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
};

beforeEach(() => {
  jest.clearAllMocks();
  stored({});
  (saveViewMode as jest.Mock).mockResolvedValue(undefined);
});

it("holds off until storage answers, then settles on rows with captions", async () => {
  // The screens wait on `ready`: the tree and the grid load different data,
  // and the wrong first guess costs a whole fetch.
  let finish!: () => void;
  mockLoad.mockReturnValue(
    new Promise((resolve) => {
      finish = () => resolve(null);
    }),
  );
  const { result } = await renderHook(() => useSpeciesViewMode());

  expect(result.current.ready).toBe(false);

  await act(async () => finish());

  expect(result.current.ready).toBe(true);
  expect(result.current.layout).toBe("list");
  expect(result.current.isPhotos).toBe(false);
  expect(result.current.showCaptions).toBe(true);
});

it("restores the grid and hidden captions from storage", async () => {
  stored({ SpeciesLayout: "photos", SpeciesCaptions: "hidden" });

  const { result } = await renderReady();

  expect(result.current.isPhotos).toBe(true);
  expect(result.current.showCaptions).toBe(false);
});

it("reads one preference for every species list, not one per screen", async () => {
  await renderReady();

  expect(mockLoad).toHaveBeenCalledWith("SpeciesLayout");
  expect(mockLoad).toHaveBeenCalledWith("SpeciesCaptions");
});

it("ignores anything else stored under the keys", async () => {
  stored({ SpeciesLayout: "map", SpeciesCaptions: false });

  const { result } = await renderReady();

  expect(result.current.layout).toBe("list");
  expect(result.current.showCaptions).toBe(true);
});

it("remembers a layout switch", async () => {
  const { result } = await renderReady();

  await act(async () => result.current.changeLayout("photos"));

  expect(result.current.isPhotos).toBe(true);
  expect(saveViewMode).toHaveBeenCalledWith("SpeciesLayout", "photos");
});

it("toggles the captions and remembers each flip", async () => {
  const { result } = await renderReady();

  await act(async () => result.current.toggleCaptions());
  expect(result.current.showCaptions).toBe(false);
  expect(saveViewMode).toHaveBeenLastCalledWith("SpeciesCaptions", "hidden");

  await act(async () => result.current.toggleCaptions());
  expect(result.current.showCaptions).toBe(true);
  expect(saveViewMode).toHaveBeenLastCalledWith("SpeciesCaptions", "shown");
});

it("offers list and photos, and the photos option alone for screens with layouts of their own", async () => {
  const { result } = await renderReady();

  expect(result.current.options.map((o) => o.value)).toEqual([
    "list",
    "photos",
  ]);
  expect(result.current.photosOption.value).toBe("photos");
});
