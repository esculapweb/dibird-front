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

import { fireEvent, render, screen } from "@testing-library/react-native";
import SearchInput from "../SearchInput";

const mockOnChange = jest.fn();
const mockOnClear = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows the given placeholder", async () => {
  await render(<SearchInput placeholder="Search species..." value="" />);
  expect(screen.getByPlaceholderText("Search species...")).toBeOnTheScreen();
});

it("calls onChange as the user types", async () => {
  await render(<SearchInput placeholder="Search" value="" onChange={mockOnChange} />);
  fireEvent.changeText(screen.getByPlaceholderText("Search"), "robin");
  expect(mockOnChange).toHaveBeenCalledWith("robin");
});

describe("clear button", () => {
  it("is hidden when there's no value", async () => {
    await render(<SearchInput placeholder="Search" value="" onClear={mockOnClear} />);
    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });

  it("is hidden when value is undefined", async () => {
    await render(<SearchInput placeholder="Search" onClear={mockOnClear} />);
    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });

  it("shows once there's a non-empty value, and calls onClear when pressed", async () => {
    await render(<SearchInput placeholder="Search" value="robin" onClear={mockOnClear} />);
    const clearButton = screen.getByRole("button");
    expect(clearButton).toBeOnTheScreen();

    await fireEvent.press(clearButton);
    expect(mockOnClear).toHaveBeenCalledTimes(1);
  });
});
