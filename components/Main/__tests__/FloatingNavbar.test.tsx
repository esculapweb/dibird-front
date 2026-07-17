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
jest.mock("../../ui/FloatingHeader", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
  };
});
jest.mock("../../../hooks/useUnreadCount", () => ({ useUnreadCount: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import { useUnreadCount } from "../../../hooks/useUnreadCount";
import FloatingNavbar from "../FloatingNavbar";
import { Filters, TerritoryDropdownItem } from "../../../types";

const mockNavigation = createNavigationMock();
const mockOnPress = jest.fn();

const mockUnread = (data: number | undefined) => {
  (useUnreadCount as jest.Mock).mockReturnValue({ data });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUnread(0);
});

describe("filter pill", () => {
  it("shows a globe icon when no territory filter is set", async () => {
    await render(<FloatingNavbar onPress={mockOnPress} filters={{} as Filters} />);
    expect(screen.getByText("globe-outline")).toBeOnTheScreen();
  });

  it("shows the country's flag icon when a territory filter is set", async () => {
    await render(
      <FloatingNavbar
        onPress={mockOnPress}
        filters={{ territory: 5 } as Filters}
        country={{ icon: "🇫🇷" } as TerritoryDropdownItem}
      />,
    );
    expect(screen.getByText("🇫🇷")).toBeOnTheScreen();
    expect(screen.queryByText("globe-outline")).not.toBeOnTheScreen();
  });

  it("calls onPress when the pill is tapped", async () => {
    await render(<FloatingNavbar onPress={mockOnPress} filters={{} as Filters} />);
    await fireEvent.press(screen.getByText("All time"));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
});

describe("notifications bell", () => {
  it("navigates to Notifications when tapped", async () => {
    await render(<FloatingNavbar onPress={mockOnPress} filters={{} as Filters} />);
    await fireEvent.press(screen.getByText("notifications-outline"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Notifications");
  });

  it("hides the badge when unread count is 0 or undefined", async () => {
    mockUnread(0);
    const { rerender } = await render(<FloatingNavbar onPress={mockOnPress} filters={{} as Filters} />);
    expect(screen.queryByText("0")).not.toBeOnTheScreen();

    mockUnread(undefined);
    await rerender(<FloatingNavbar onPress={mockOnPress} filters={{} as Filters} />);
    expect(screen.queryByText("undefined")).not.toBeOnTheScreen();
  });

  it("shows the exact count when 1-99", async () => {
    mockUnread(7);
    await render(<FloatingNavbar onPress={mockOnPress} filters={{} as Filters} />);
    expect(screen.getByText("7")).toBeOnTheScreen();
  });

  it("caps the badge at '99+' beyond 99", async () => {
    mockUnread(150);
    await render(<FloatingNavbar onPress={mockOnPress} filters={{} as Filters} />);
    expect(screen.getByText("99+")).toBeOnTheScreen();
  });
});
