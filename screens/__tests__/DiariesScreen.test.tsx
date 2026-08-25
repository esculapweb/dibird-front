jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useFocusEffect: (cb: () => void) => cb(),
}));
jest.mock("../../util/fetches", () => ({
  fetchDiaries: jest.fn(),
}));
jest.mock("../../services/sync/diarySync", () => ({
  runDiarySync: jest.fn(),
}));
jest.mock("../../store/filters-context", () => ({
  useFilters: jest.fn(),
}));
// DiaryCard is a separately-testable widget (its own useNavigation, image,
// sync-status icon) — this screen's own job is just picking which item type
// renders it and with what props.
jest.mock("../../components/Diary/DiaryCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, index }: { item: { id: number }; index: number }) => (
      <Text>{`diary-card-${item.id}-${index}`}</Text>
    ),
  };
});
// ListScreen itself is fully covered by ListScreen.test.tsx — mock it here
// to isolate DiariesScreen's own responsibility: computing the right props
// (fetchFunction/title/onAdd defaults) rather than re-testing the list shell.
const mockListScreenCapture = jest.fn();
jest.mock("../ListScreen", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockListScreenCapture(props);
    return null;
  },
}));

import { act, render } from "@testing-library/react-native";
import { fetchDiaries } from "../../util/fetches";
import { runDiarySync } from "../../services/sync/diarySync";
import { useFilters } from "../../store/filters-context";
import { createNavigationMock, createRouteMock } from "../test-utils";
import DiariesScreen from "../DiariesScreen";

const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("Diaries", {});

beforeEach(() => {
  jest.clearAllMocks();
  (useFilters as jest.Mock).mockReturnValue({ territory: 5 });
});

it("passes fetchDiaries and titles/errors through to ListScreen", async () => {
  await render(<DiariesScreen />);

  const props = mockListScreenCapture.mock.calls[0][0];
  expect(props.fetchFunction).toBe(fetchDiaries);
  expect(props.allowedFilters).toContain("private");
  expect(props.title).toBe("diaries");
  expect(props.errorTitle).toBe("diaries_unavailable");
});

it("retries the diary sync queue on focus", async () => {
  await render(<DiariesScreen />);
  expect(runDiarySync).toHaveBeenCalledTimes(1);
});

it("renders a DiaryCard for each item via renderItem", async () => {
  await render(<DiariesScreen />);
  const { renderItem } = mockListScreenCapture.mock.calls[0][0];
  const { getByText } = await render(renderItem({ item: { id: 7 }, index: 2 }));
  expect(getByText("diary-card-7-2")).toBeOnTheScreen();
});

describe("handleAdd defaults", () => {
  it("falls back to the global territory filter when no list filter is active yet", async () => {
    await render(<DiariesScreen />);
    const { onAdd } = mockListScreenCapture.mock.calls[0][0];
    await onAdd();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("DiaryEditor", {
      defaultTerritory: 5,
      defaultPlace: null,
    });
  });

  it("prefers the list's own active territory/place filters once set", async () => {
    await render(<DiariesScreen />);
    const { onFiltersChange } = mockListScreenCapture.mock.calls[0][0];
    await act(async () => {
      await onFiltersChange({ territory: 9, place: 3 });
    });
    // onFiltersChange updates state — re-render to pick up the new onAdd closure.
    const propsAfter = mockListScreenCapture.mock.calls.at(-1)[0];
    await propsAfter.onAdd();
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith("DiaryEditor", {
      defaultTerritory: 9,
      defaultPlace: 3,
    });
  });

  it("noItems' first action triggers the same handleAdd", async () => {
    await render(<DiariesScreen />);
    const { noItems, onAdd } = mockListScreenCapture.mock.calls[0][0];
    expect(noItems.actions[0].onPress).toBe(onAdd);
  });
});
