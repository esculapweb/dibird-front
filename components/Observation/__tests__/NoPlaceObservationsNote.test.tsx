jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});
jest.mock("../../../util/fetches", () => ({
  fetchNoPlaceObservationCount: jest.fn(),
}));

import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";

notifyManager.setScheduler((callback) => callback());

import { fetchNoPlaceObservationCount } from "../../../util/fetches";
import NoPlaceObservationsNote from "../NoPlaceObservationsNote";
import { Filters } from "../../../types";

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const renderNote = async (filters: Filters | null = {}) =>
  render(<NoPlaceObservationsNote filters={filters} />, { wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

it("says how many observations the map cannot show", async () => {
  (fetchNoPlaceObservationCount as jest.Mock).mockResolvedValue(3);

  await renderNote();

  await waitFor(() =>
    expect(
      screen.getByText('map_observations_without_place:{"count":3}'),
    ).toBeOnTheScreen(),
  );
});

it("stays out of the way when nothing is missing", async () => {
  (fetchNoPlaceObservationCount as jest.Mock).mockResolvedValue(0);

  await renderNote();

  await waitFor(() =>
    expect(fetchNoPlaceObservationCount).toHaveBeenCalledTimes(1),
  );
  expect(screen.queryByTestId("observations-no-place-note")).toBeNull();
});

it("says nothing when the count cannot be fetched", async () => {
  // Offline is the ordinary case here: the map beside it still paints from
  // cache, and an error toast for a footnote would be noise.
  (fetchNoPlaceObservationCount as jest.Mock).mockRejectedValue(
    new Error("Network Error"),
  );

  await renderNote();

  await waitFor(() =>
    expect(fetchNoPlaceObservationCount).toHaveBeenCalledTimes(1),
  );
  expect(screen.queryByTestId("observations-no-place-note")).toBeNull();
});

it("asks again when the filters change", async () => {
  (fetchNoPlaceObservationCount as jest.Mock).mockResolvedValue(2);

  const { rerender } = await renderNote({ territory: 5 });
  await waitFor(() =>
    expect(fetchNoPlaceObservationCount).toHaveBeenCalledTimes(1),
  );

  await rerender(<NoPlaceObservationsNote filters={{ territory: 9 }} />);

  await waitFor(() =>
    expect(fetchNoPlaceObservationCount).toHaveBeenCalledTimes(2),
  );
});
