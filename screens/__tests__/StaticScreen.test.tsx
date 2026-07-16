jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
  };
});
jest.mock("@react-navigation/native", () => ({
  useRoute: () => mockRoute,
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));
jest.mock("../../util/fetches", () => ({
  fetchPage: jest.fn(),
}));
jest.mock("../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));
jest.mock("../../hooks/useContentWidth", () => ({
  useContentWidth: () => 400,
}));
// react-native-render-html is a heavy third-party HTML renderer unrelated
// to this screen's own loading/error/data branching — stub to expose the
// html source as plain text.
jest.mock("react-native-render-html", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ source }: { source: { html: string } }) => <Text>{source.html}</Text>,
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchPage } from "../../util/fetches";
import { createRouteMock } from "../test-utils";
import StaticScreen from "../StaticScreen";

let mockRoute: ReturnType<typeof createRouteMock>;
const mockRefetch = jest.fn();

const mockQuery = (overrides: Record<string, unknown> = {}) => {
  (useQuery as jest.Mock).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = createRouteMock("Privacy", {});
  mockQuery();
});

it("queries the page keyed by route name and language, via the right slug", async () => {
  await render(<StaticScreen />);
  const call = (useQuery as jest.Mock).mock.calls[0][0];
  expect(call.queryKey).toEqual(["Page", "Privacy", "en"]);

  (fetchPage as jest.Mock).mockResolvedValueOnce("<p>html</p>");
  await call.queryFn();
  expect(fetchPage).toHaveBeenCalledWith("privacy");
});

it("shows the loading indicator while there's no data yet", async () => {
  mockQuery({ isLoading: true });
  await render(<StaticScreen />);
  expect(screen.getByTestId("static-loading")).toBeOnTheScreen();
});

it("shows an error overlay with retry only when there's truly no data to fall back on", async () => {
  mockQuery({ isError: true, error: { message: "boom" } });
  await render(<StaticScreen />);

  expect(screen.getByText("page_unavailable")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("try_again"));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it("keeps rendering cached content instead of the error overlay when a background refetch fails", async () => {
  mockQuery({ isError: true, error: { message: "boom" }, data: "<p>Cached</p>" });
  await render(<StaticScreen />);

  expect(screen.queryByText("page_unavailable")).not.toBeOnTheScreen();
  expect(screen.getByText("<p>Cached</p>")).toBeOnTheScreen();
});

it("renders the fetched html", async () => {
  mockQuery({ data: "<p>Privacy policy text</p>" });
  await render(<StaticScreen />);
  expect(screen.getByText("<p>Privacy policy text</p>")).toBeOnTheScreen();
});

it("renders nothing when there's no data and nothing loading or erroring (e.g. empty response)", async () => {
  const result = await render(<StaticScreen />);
  expect(result.toJSON()).toBeNull();
});
