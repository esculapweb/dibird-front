jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import QuickActions from "../QuickActions";
import { Filters } from "../../../types";

const mockNavigation = createNavigationMock();

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders diary and observation quick-action buttons", async () => {
  await render(<QuickActions filters={{} as Filters} />);
  expect(screen.getByText("diary", { exact: false })).toBeOnTheScreen();
  expect(screen.getByText("observation", { exact: false })).toBeOnTheScreen();
});

describe("diary quick action", () => {
  it("navigates to DiaryEditor with the current territory filter", async () => {
    await render(<QuickActions filters={{ territory: 5 } as Filters} />);
    await fireEvent.press(screen.getByTestId("quick-action-diary"));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("DiaryEditor", {
      defaultTerritory: 5,
      returnMode: "back",
    });
  });

  it("passes null when there's no territory filter set", async () => {
    await render(<QuickActions filters={{} as Filters} />);
    await fireEvent.press(screen.getByTestId("quick-action-diary"));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("DiaryEditor", {
      defaultTerritory: null,
      returnMode: "back",
    });
  });
});

describe("observation quick action", () => {
  it("navigates to ObservationEditor with the current territory filter", async () => {
    await render(<QuickActions filters={{ territory: 9 } as Filters} />);
    await fireEvent.press(screen.getByTestId("quick-action-observation"));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
      defaultTerritory: 9,
    });
  });

  it("passes null when there's no territory filter set", async () => {
    await render(<QuickActions filters={{} as Filters} />);
    await fireEvent.press(screen.getByTestId("quick-action-observation"));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
      defaultTerritory: null,
    });
  });
});
