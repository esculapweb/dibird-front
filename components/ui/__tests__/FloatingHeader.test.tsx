jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({ ...require("../../../screens/mockTheme").mockUseTheme(), isDark: false }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ openDrawer: mockOpenDrawer }),
}));
jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return {
    LinearGradient: (props: Record<string, unknown>) => (
      <View testID="header-gradient" {...props} />
    ),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import FloatingHeader from "../FloatingHeader";

const mockOpenDrawer = jest.fn();

beforeEach(() => jest.clearAllMocks());

it("opens the drawer from the burger button", async () => {
  await render(<FloatingHeader />);

  await fireEvent.press(screen.getByTestId("burger-menu-button"));
  expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
});

it("lets touches through to the screen underneath", async () => {
  // The header floats over the screen's scroll view. If it captured touches,
  // a drag started in the top strip — where pull to refresh is done — would
  // never reach the content.
  await render(
    <FloatingHeader>
      <Text>child</Text>
    </FloatingHeader>,
  );

  let container = screen.getByTestId("burger-menu-button").parent;
  while (container && container.props.pointerEvents !== "box-none") {
    container = container.parent;
  }

  expect(container).not.toBeNull();
  expect(screen.getByTestId("header-gradient").props.pointerEvents).toBe("none");
});
