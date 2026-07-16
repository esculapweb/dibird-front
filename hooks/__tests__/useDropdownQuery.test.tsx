jest.mock("../useSavedSort", () => ({ useSavedSort: jest.fn() }));
jest.mock("../../util/sortOptionsList", () => ({ sortOptionsList: jest.fn() }));

import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useSavedSort } from "../useSavedSort";
import { sortOptionsList } from "../../util/sortOptionsList";
import { useDropdownQuery } from "../useDropdownQuery";

// See hooks/Diary/__tests__/useOfflineDiary.test.tsx's comment on this —
// keeps state updates inside the same act() as the awaited call instead of
// a tick later via react-query's real setTimeout(0) scheduler.
notifyManager.setScheduler((callback) => callback());

const PLACES_DROPDOWN_OPTIONS = [
  { label: "Distance", value: "distance" },
  { label: "Distance desc", value: "-distance" },
  { label: "Favourite", value: "-favourite,name" },
  { label: "Name", value: "name" },
];

const mockOnChange = jest.fn();
const mockOnLocationUnavailable = jest.fn();
const mockRequestLocation = jest.fn();
const mockQueryFn = jest.fn();

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const mockSavedSort = (overrides: Partial<{ sort: string; loaded: boolean }> = {}) => {
  (useSavedSort as jest.Mock).mockReturnValue({
    sort: "name",
    loaded: true,
    onChange: mockOnChange,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  (sortOptionsList as jest.Mock).mockReturnValue(PLACES_DROPDOWN_OPTIONS);
  mockQueryFn.mockResolvedValue([{ value: 1, label: "Item" }]);
  mockSavedSort();
});

afterEach(() => {
  queryClient.clear();
});

describe("effectiveSort", () => {
  it("passes the saved sort through unchanged when it isn't a distance sort", async () => {
    mockSavedSort({ sort: "name" });
    const { result } = await renderHook(
      () => useDropdownQuery({ type: "PlacesDropdown", queryFn: mockQueryFn, params: [] }),
      { wrapper },
    );
    expect(result.current.sort).toBe("name");
  });

  it("falls back to the first non-distance option when permission is denied", async () => {
    mockSavedSort({ sort: "distance" });
    const { result } = await renderHook(
      () =>
        useDropdownQuery({
          type: "PlacesDropdown",
          queryFn: mockQueryFn,
          params: [],
          permissionStatus: "denied",
        }),
      { wrapper },
    );
    expect(result.current.sort).toBe("-favourite,name");
  });

  it("keeps the distance sort when permission isn't denied", async () => {
    mockSavedSort({ sort: "distance" });
    const { result } = await renderHook(
      () =>
        useDropdownQuery({
          type: "PlacesDropdown",
          queryFn: mockQueryFn,
          params: [],
          permissionStatus: "granted",
        }),
      { wrapper },
    );
    expect(result.current.sort).toBe("distance");
  });

  it("falls back to the raw sort value when every option is a distance sort", async () => {
    (sortOptionsList as jest.Mock).mockReturnValue([
      { label: "Distance", value: "distance" },
      { label: "Distance desc", value: "-distance" },
    ]);
    mockSavedSort({ sort: "distance" });
    const { result } = await renderHook(
      () =>
        useDropdownQuery({
          type: "PlacesDropdown",
          queryFn: mockQueryFn,
          params: [],
          permissionStatus: "denied",
        }),
      { wrapper },
    );
    expect(result.current.sort).toBe("distance");
  });
});

describe("query wiring", () => {
  it("only fetches once useSavedSort has loaded", async () => {
    mockSavedSort({ loaded: false });
    const { result } = await renderHook(
      () => useDropdownQuery({ type: "PlacesDropdown", queryFn: mockQueryFn, params: [] }),
      { wrapper },
    );
    expect(mockQueryFn).not.toHaveBeenCalled();
    expect(result.current.query.fetchStatus).toBe("idle");
  });

  it("fetches with the effective sort once loaded and enabled", async () => {
    const { result } = await renderHook(
      () => useDropdownQuery({ type: "PlacesDropdown", queryFn: mockQueryFn, params: [] }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(mockQueryFn).toHaveBeenCalledWith("name");
  });

  it("does not fetch when explicitly disabled, even once loaded", async () => {
    await renderHook(
      () => useDropdownQuery({ type: "PlacesDropdown", queryFn: mockQueryFn, params: [], enabled: false }),
      { wrapper },
    );
    expect(mockQueryFn).not.toHaveBeenCalled();
  });

  it("maps results into a Map keyed by value when mapResult is true, preferring name_lang over label", async () => {
    mockQueryFn.mockResolvedValue([
      { value: 1, label: "fallback", name_lang: "Robin" },
      { value: 2, label: "Blackbird" },
    ]);
    const { result } = await renderHook(
      () =>
        useDropdownQuery({
          type: "SpeciesDropdown",
          queryFn: mockQueryFn,
          params: [],
          mapResult: true,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.query.data).toEqual(
      new Map([
        [1, "Robin"],
        [2, "Blackbird"],
      ]),
    );
  });
});

describe("onSortChange", () => {
  it("applies a non-distance sort directly", async () => {
    const { result } = await renderHook(
      () => useDropdownQuery({ type: "PlacesDropdown", queryFn: mockQueryFn, params: [] }),
      { wrapper },
    );
    await act(async () => {
      await result.current.onSortChange("name");
    });
    expect(mockOnChange).toHaveBeenCalledWith("name");
  });

  it("reports location-unavailable instead of applying a distance sort when permission was denied", async () => {
    const { result } = await renderHook(
      () =>
        useDropdownQuery({
          type: "PlacesDropdown",
          queryFn: mockQueryFn,
          params: [],
          permissionStatus: "denied",
          onLocationUnavailable: mockOnLocationUnavailable,
          requestLocation: mockRequestLocation,
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.onSortChange("distance");
    });
    expect(mockOnLocationUnavailable).toHaveBeenCalledTimes(1);
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });

  it("requests location and defers the sort change when permission is undetermined", async () => {
    const { result } = await renderHook(
      () =>
        useDropdownQuery({
          type: "PlacesDropdown",
          queryFn: mockQueryFn,
          params: [],
          permissionStatus: "undetermined",
          locationAvailable: false,
          requestLocation: mockRequestLocation,
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.onSortChange("distance");
    });
    expect(mockRequestLocation).toHaveBeenCalledTimes(1);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("requests location when permission is granted but a coordinate isn't available yet", async () => {
    const { result } = await renderHook(
      () =>
        useDropdownQuery({
          type: "PlacesDropdown",
          queryFn: mockQueryFn,
          params: [],
          permissionStatus: "granted",
          locationAvailable: false,
          requestLocation: mockRequestLocation,
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.onSortChange("distance");
    });
    expect(mockRequestLocation).toHaveBeenCalledTimes(1);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("applies a distance sort directly when permission is granted and a coordinate is already available", async () => {
    const { result } = await renderHook(
      () =>
        useDropdownQuery({
          type: "PlacesDropdown",
          queryFn: mockQueryFn,
          params: [],
          permissionStatus: "granted",
          locationAvailable: true,
          requestLocation: mockRequestLocation,
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.onSortChange("distance");
    });
    expect(mockOnChange).toHaveBeenCalledWith("distance");
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });

  it("applies the deferred sort once a coordinate becomes available after the request", async () => {
    const { result, rerender } = await renderHook(
      (props: { locationAvailable: boolean }) =>
        useDropdownQuery({
          type: "PlacesDropdown",
          queryFn: mockQueryFn,
          params: [],
          permissionStatus: "granted",
          locationAvailable: props.locationAvailable,
          requestLocation: mockRequestLocation,
        }),
      { wrapper, initialProps: { locationAvailable: false } },
    );

    await act(async () => {
      await result.current.onSortChange("distance");
    });
    expect(mockOnChange).not.toHaveBeenCalled();

    await rerender({ locationAvailable: true });
    expect(mockOnChange).toHaveBeenCalledWith("distance");
  });
});
