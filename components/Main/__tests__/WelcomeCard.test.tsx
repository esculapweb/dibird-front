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
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});

import { render, screen } from "@testing-library/react-native";
import WelcomeCard from "../WelcomeCard";

it("explains what the app does in one line", async () => {
  await render(<WelcomeCard />);

  expect(screen.getByText("welcome_card_text")).toBeOnTheScreen();
});

it("offers no button of its own — the add buttons sit right above it", async () => {
  const { queryAllByRole } = await render(<WelcomeCard />);

  expect(queryAllByRole("button")).toHaveLength(0);
});
