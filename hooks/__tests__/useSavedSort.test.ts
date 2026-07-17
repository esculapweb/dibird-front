jest.mock("../../util/storageHelper", () => ({ loadSort: jest.fn(), saveSort: jest.fn() }));

import { act, renderHook, waitFor } from "@testing-library/react-native";
import { loadSort, saveSort } from "../../util/storageHelper";
import { useSavedSort } from "../useSavedSort";

beforeEach(() => {
  jest.clearAllMocks();
  (saveSort as jest.Mock).mockResolvedValue(undefined);
});

it("starts with the screen's default (first) sort option, not yet loaded", async () => {
  // `renderHook` (async) fully drains the microtask queue, so a
  // mockResolvedValue would resolve within that same call and "loaded:
  // false" would never be observable — hold loadSort open until asserted.
  let resolveLoad!: (v: unknown) => void;
  (loadSort as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      resolveLoad = resolve;
    }),
  );
  const { result } = await renderHook(() => useSavedSort("Diaries"));

  expect(result.current.sort).toBe("-date_time");
  expect(result.current.loaded).toBe(false);

  await act(async () => {
    resolveLoad(null);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(result.current.loaded).toBe(true);
});

it("adopts the stored sort once it resolves, and marks loaded", async () => {
  (loadSort as jest.Mock).mockResolvedValue("date_time");
  const { result } = await renderHook(() => useSavedSort("Diaries"));

  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.sort).toBe("date_time");
  expect(loadSort).toHaveBeenCalledWith("Diaries");
});

it("falls back to the default when the stored value isn't a valid option for this screen", async () => {
  (loadSort as jest.Mock).mockResolvedValue("not-a-real-sort");
  const { result } = await renderHook(() => useSavedSort("Diaries"));

  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.sort).toBe("-date_time");
});

it("falls back to the default when nothing was stored", async () => {
  (loadSort as jest.Mock).mockResolvedValue(null);
  const { result } = await renderHook(() => useSavedSort("Diaries"));

  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.sort).toBe("-date_time");
});

describe("onChange", () => {
  it("updates sort immediately and persists it for this screen", async () => {
    (loadSort as jest.Mock).mockResolvedValue(null);
    const { result } = await renderHook(() => useSavedSort("Diaries"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.onChange("date_time");
    });
    expect(result.current.sort).toBe("date_time");
    expect(saveSort).toHaveBeenCalledWith("Diaries", "date_time");
  });
});
