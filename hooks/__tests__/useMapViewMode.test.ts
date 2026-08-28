jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../util/storageHelper", () => ({
  loadViewMode: jest.fn(),
  saveViewMode: jest.fn(),
}));

import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useMapViewMode } from "../useMapViewMode";
import { loadViewMode, saveViewMode } from "../../util/storageHelper";

/** Lets a test hold the stored-mode read open. */
const pendingRead = () => {
  let resolveRead!: (value: unknown) => void;
  (loadViewMode as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      resolveRead = resolve;
    }),
  );
  return (value: unknown) =>
    act(async () => {
      resolveRead(value);
    });
};

beforeEach(() => {
  jest.clearAllMocks();
  (loadViewMode as jest.Mock).mockResolvedValue(null);
  (saveViewMode as jest.Mock).mockResolvedValue(undefined);
});

it("holds off until storage answers, then settles on the list", async () => {
  // Screens gate their first render on `ready`: rendering the list and then
  // swapping it for the map costs a whole wasted fetch.
  const finishRead = pendingRead();
  const { result } = await renderHook(() => useMapViewMode("Places"));

  expect(result.current.ready).toBe(false);
  expect(result.current.viewMode).toBe("list");

  await finishRead(null);

  expect(result.current.ready).toBe(true);
  expect(result.current.viewMode).toBe("list");
});

it("restores the mode last used on that screen", async () => {
  (loadViewMode as jest.Mock).mockResolvedValue("map");

  const { result } = await renderHook(() => useMapViewMode("Observations"));

  await waitFor(() => expect(result.current.viewMode).toBe("map"));
  expect(loadViewMode).toHaveBeenCalledWith("Observations");
});

it("ignores anything else stored under the key", async () => {
  (loadViewMode as jest.Mock).mockResolvedValue("globe");

  const { result } = await renderHook(() => useMapViewMode("Places"));

  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.viewMode).toBe("list");
});

it("remembers a switch against the screen it belongs to", async () => {
  const { result } = await renderHook(() => useMapViewMode("Places"));
  await waitFor(() => expect(result.current.ready).toBe(true));

  await act(async () => {
    result.current.changeViewMode("map");
  });

  expect(result.current.viewMode).toBe("map");
  expect(saveViewMode).toHaveBeenCalledWith("Places", "map");
});

it("offers exactly the list and map choices", async () => {
  const { result } = await renderHook(() => useMapViewMode("Places"));
  await waitFor(() => expect(result.current.ready).toBe(true));

  expect(result.current.options.map((option) => option.value)).toEqual([
    "list",
    "map",
  ]);
});

it("does not set state after the screen is gone", async () => {
  // Leaving the screen while the read is still in flight: the guard in the
  // effect is what keeps the late answer from writing into a dead component.
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const finishRead = pendingRead();
  const { unmount } = await renderHook(() => useMapViewMode("Places"));

  await act(async () => {
    unmount();
  });
  await finishRead("map");

  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});
