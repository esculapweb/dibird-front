jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@react-navigation/native", () => ({
  useRoute: () => mockRoute,
}));
jest.mock("../../util/fetches", () => ({
  fetchCommunityObservations: jest.fn(),
}));
jest.mock("../../store/location-context", () => ({
  useLocation: jest.fn(),
}));
jest.mock("../../hooks/useLocationUnavailable", () => ({
  useLocationUnavailable: jest.fn(),
}));
// CommunityCard is a separately-testable widget — this screen's own job is
// just picking which item type renders it and with what props.
jest.mock("../../components/Community/CommunityCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, index, highlightObsIds }: {
      item: { id: number };
      index: number;
      highlightObsIds?: number[];
    }) => <Text>{`community-card-${item.id}-${index}-${JSON.stringify(highlightObsIds ?? null)}`}</Text>,
  };
});
// ListScreen itself is fully covered by ListScreen.test.tsx — mock it here
// to isolate CommunityScreen's own responsibility: computing the right props
// rather than re-testing the list shell.
const mockListScreenCapture = jest.fn();
jest.mock("../ListScreen", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockListScreenCapture(props);
    return null;
  },
}));

import { render } from "@testing-library/react-native";
import { fetchCommunityObservations } from "../../util/fetches";
import { useLocation } from "../../store/location-context";
import { useLocationUnavailable } from "../../hooks/useLocationUnavailable";
import { createRouteMock } from "../test-utils";
import CommunityScreen from "../CommunityScreen";

let mockRoute: ReturnType<typeof createRouteMock>;
const mockHandleLocationUnavailable = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = createRouteMock("Community", {});
  (useLocation as jest.Mock).mockReturnValue({
    locationCoords: { latitude: 1, longitude: 2 },
    locationAvailable: true,
  });
  (useLocationUnavailable as jest.Mock).mockReturnValue(mockHandleLocationUnavailable);
});

it("passes fetchCommunityObservations, title/errorTitle and allowedFilters through to ListScreen", async () => {
  await render(<CommunityScreen />);

  const props = mockListScreenCapture.mock.calls[0][0];
  expect(props.fetchFunction).toBe(fetchCommunityObservations);
  expect(props.title).toBe("community");
  expect(props.errorTitle).toBe("observations_unavailable");
  expect(props.allowedFilters).toEqual(["territory", "date", "species"]);
});

it("forwards the current location and its unavailable-handler through to ListScreen", async () => {
  await render(<CommunityScreen />);
  const props = mockListScreenCapture.mock.calls[0][0];
  expect(props.locationCoords).toEqual({ latitude: 1, longitude: 2 });
  expect(props.locationAvailable).toBe(true);
  expect(props.onLocationUnavailable).toBe(mockHandleLocationUnavailable);
});

it("renders a CommunityCard per item, forwarding highlightObsIds from route params", async () => {
  mockRoute = createRouteMock("Community", { highlightObsIds: [5, 9] });
  await render(<CommunityScreen />);
  const { renderItem } = mockListScreenCapture.mock.calls[0][0];
  const { getByText } = await render(renderItem({ item: { id: 7 }, index: 2 }));
  expect(getByText("community-card-7-2-[5,9]")).toBeOnTheScreen();
});

it("renderItem passes undefined highlightObsIds when the route has none", async () => {
  await render(<CommunityScreen />);
  const { renderItem } = mockListScreenCapture.mock.calls[0][0];
  const { getByText } = await render(renderItem({ item: { id: 3 }, index: 0 }));
  expect(getByText("community-card-3-0-null")).toBeOnTheScreen();
});
