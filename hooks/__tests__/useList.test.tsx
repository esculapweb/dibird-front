// useList wraps @tanstack/react-query's useInfiniteQuery directly — the
// query-key derivation (filters/sort/search/tabsMode/location merge) and
// pagination cursor IS the thing under test, so a real QueryClient is used.
jest.mock("../../store/language-context", () => ({ useLanguage: jest.fn() }));

import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

notifyManager.setScheduler((callback) => callback());

import { useLanguage } from "../../store/language-context";
import { useList } from "../useList";
import { Filters, PaginatedResponse } from "../../types";

const mockFetchFunction = jest.fn();

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

type ListProps = Parameters<typeof useList>[0];

// See hooks/__tests__/useItem.test.tsx's comment: react-query v5 only
// re-renders subscribers for fields actually read during render, so spread
// the result to opt every field into tracking (matching how a real screen
// destructuring `{ data, isLoading, fetchNextPage, ... }` would). A
// props-based render function (rather than a closure over captured args)
// is required for `rerender(newProps)` to actually take effect.
const renderUseList = (props: ListProps) =>
  renderHook((p: ListProps) => ({ ...useList(p) }), { initialProps: props, wrapper });

const page = (overrides: Partial<PaginatedResponse<unknown>["pagination"]> = {}): PaginatedResponse<unknown> => ({
  results: [{ id: 1 }],
  pagination: { count: 1, per_page: 20, current: 1, final: 1, next: null, previous: null, ...overrides },
});

const baseArgs = (overrides: Record<string, unknown> = {}) => ({
  screenName: "Diaries",
  fetchFunction: mockFetchFunction,
  filters: {} as Filters,
  sort: null as string | null,
  enabled: true,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  (useLanguage as jest.Mock).mockReturnValue({ language: "en" });
  mockFetchFunction.mockResolvedValue(page());
});

afterEach(() => {
  queryClient.clear();
});

it("fetches page 1 with the merged filters/sort/search on mount", async () => {
  const { result } = await renderUseList(
    baseArgs({ filters: { territory: 5 }, sort: "-date_time", search: "robin" }),
  );

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mockFetchFunction).toHaveBeenCalledWith({ territory: 5 }, "-date_time", "robin", 1);
});

it("defaults search to an empty string when omitted", async () => {
  const { result } = await renderUseList(baseArgs());
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mockFetchFunction).toHaveBeenCalledWith({}, null, "", 1);
});

it("does not fetch while disabled", async () => {
  const { result } = await renderUseList(baseArgs({ enabled: false }));
  expect(result.current.fetchStatus).toBe("idle");
  expect(mockFetchFunction).not.toHaveBeenCalled();
});

describe("mergedFilters", () => {
  it("overlays extraFilters on top of filters", async () => {
    const { result } = await renderUseList(
      baseArgs({ filters: { territory: 5, place: 9 }, extraFilters: { place: 12 } }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetchFunction).toHaveBeenCalledWith({ territory: 5, place: 12 }, null, "", 1);
  });

  it("treats a null filters/extraFilters as empty objects", async () => {
    const { result } = await renderUseList(baseArgs({ filters: null, extraFilters: null }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetchFunction).toHaveBeenCalledWith({}, null, "", 1);
  });
});

describe("pagination cursor", () => {
  it("exposes a next page when current < final", async () => {
    mockFetchFunction.mockResolvedValue(page({ current: 1, final: 3 }));
    const { result } = await renderUseList(baseArgs());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(mockFetchFunction).toHaveBeenCalledTimes(2));
    expect(mockFetchFunction).toHaveBeenLastCalledWith({}, null, "", 2);
  });

  it("reports no next page once current reaches final", async () => {
    mockFetchFunction.mockResolvedValue(page({ current: 3, final: 3 }));
    const { result } = await renderUseList(baseArgs());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("query key sensitivity — a changed input triggers a refetch", () => {
  const rerenderWith = async (overrides: Record<string, unknown>) => {
    const { result, rerender } = await renderUseList(baseArgs());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetchFunction).toHaveBeenCalledTimes(1);

    await rerender({ ...baseArgs(overrides) } as never);
    await waitFor(() => expect(mockFetchFunction).toHaveBeenCalledTimes(2));
  };

  it("refetches when filters change", async () => {
    await rerenderWith({ filters: { territory: 5 } });
    expect(mockFetchFunction).toHaveBeenCalledTimes(2);
  });

  it("refetches when sort changes", async () => {
    await rerenderWith({ sort: "date_time" });
    expect(mockFetchFunction).toHaveBeenCalledTimes(2);
  });

  it("refetches when search changes", async () => {
    await rerenderWith({ search: "wren" });
    expect(mockFetchFunction).toHaveBeenCalledTimes(2);
  });

  it("refetches when tabsMode changes", async () => {
    await rerenderWith({ tabsMode: "seen" });
    expect(mockFetchFunction).toHaveBeenCalledTimes(2);
  });

  it("refetches when the language changes", async () => {
    const { result, rerender } = await renderUseList(baseArgs());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetchFunction).toHaveBeenCalledTimes(1);

    (useLanguage as jest.Mock).mockReturnValue({ language: "ru" });
    await rerender({ ...baseArgs() } as never);
    await waitFor(() => expect(mockFetchFunction).toHaveBeenCalledTimes(2));
  });

  it("refetches when only the latitude changes (locationKey covers both coords, not just longitude)", async () => {
    const { result, rerender } = await renderUseList(baseArgs({ locationCoords: [1, 50] }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetchFunction).toHaveBeenCalledTimes(1);

    await rerender({ ...baseArgs({ locationCoords: [2, 50] }) } as never);
    await waitFor(() => expect(mockFetchFunction).toHaveBeenCalledTimes(2));
  });
});
