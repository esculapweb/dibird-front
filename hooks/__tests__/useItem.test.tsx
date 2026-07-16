// useItem wraps @tanstack/react-query directly (like useOffline*Diary etc.)
// — the fetch/cache-fallback orchestration IS the thing under test, so a
// real QueryClient is used instead of mocking react-query itself.
jest.mock("../../services/api", () => ({ get: jest.fn() }));
jest.mock("../repositories/listCacheRepository", () => ({
  cacheListResponse: jest.fn(),
  getCachedListResponse: jest.fn(),
}));
jest.mock("../useApiError", () => ({ useApiError: () => ({ showErrorToast: mockShowErrorToast }) }));

import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

notifyManager.setScheduler((callback) => callback());

import api from "../../services/api";
import { cacheListResponse, getCachedListResponse } from "../repositories/listCacheRepository";
import { communityItemCacheTable } from "../../services/db/schema";
import { useItem } from "../useItem";

const mockShowErrorToast = jest.fn();

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

// react-query v5's `useQuery` result is a "tracked" object — it only
// re-renders subscribers for fields the render actually read. useItem
// itself only reads `.error` (for the effect's dep array), so a bare
// `renderHook(() => useItem(...))` would freeze `result.current` at its
// first (pending) snapshot forever: nothing ever "reads" `.data`/
// `.isSuccess`, so react-query never sees a reason to re-render. Spreading
// the result forces every field to be read on every render, matching how
// a real consumer (a screen destructuring `{ data, isLoading, ... }`)
// would naturally opt into tracking them.
const renderUseItem = (...args: Parameters<typeof useItem>) =>
  renderHook(() => ({ ...useItem(...args) }), { wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

it("does not query without an id", async () => {
  const { result } = await renderUseItem(null, "Community");
  expect(result.current.fetchStatus).toBe("idle");
  expect(api.get).not.toHaveBeenCalled();
});

describe("URL resolution per type", () => {
  it.each([
    ["Place", "/myapi/place2/5/"],
    ["Observation", "/myapi/observation2/5/"],
    ["Community", "/myapi/community2/5/"],
    ["Diary", "/myapi/diary2/5/"],
  ] as const)("hits %s's dedicated endpoint", async (type, expectedUrl) => {
    (api.get as jest.Mock).mockResolvedValue({ data: { id: 5 } });
    const { result } = await renderUseItem(5, type);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(expectedUrl, { params: undefined });
  });
});

it("passes extra params through to the request", async () => {
  (api.get as jest.Mock).mockResolvedValue({ data: { id: 5 } });
  const { result } = await renderUseItem(5, "Community", { lang: "en" });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(api.get).toHaveBeenCalledWith("/myapi/community2/5/", { params: { lang: "en" } });
});

describe("on success", () => {
  it("returns the server data and caches it", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { id: 5, name: "Community post" } });
    const { result } = await renderUseItem(5, "Community");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 5, name: "Community post" });
    expect(cacheListResponse).toHaveBeenCalledWith(
      communityItemCacheTable,
      expect.stringContaining("item|Community|5|"),
      { id: 5, name: "Community post" },
      3000,
    );
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });
});

describe("on failure", () => {
  it("falls back to a cached copy without surfacing an error", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (getCachedListResponse as jest.Mock).mockReturnValue({ id: 5, name: "Cached post" });
    const { result } = await renderUseItem(5, "Community");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 5, name: "Cached post" });
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it("surfaces the error via showErrorToast when there's no cached fallback", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (getCachedListResponse as jest.Mock).mockReturnValue(undefined);
    const { result } = await renderUseItem(5, "Community");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockShowErrorToast).toHaveBeenCalledWith(expect.any(Error), "useItem:Community");
  });
});
