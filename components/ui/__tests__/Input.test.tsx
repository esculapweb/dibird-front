jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      textMain: "#000",
      textSecondary: "#666",
      error500: "#f00",
      error100: "#fee",
      primary100: "#fff",
      border: "#ccc",
    },
  }),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("../Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="bird-svg" /> };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import Input from "../Input";

const mockOnUpdateValue = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the label and current value", async () => {
  await render(<Input label="Name" value="hello" onUpdateValue={mockOnUpdateValue} testID="name-input" />);
  expect(screen.getByText("Name")).toBeOnTheScreen();
  expect(screen.getByTestId("name-input").props.value).toBe("hello");
});

it("omits the label entirely when none is given", async () => {
  await render(<Input value="" onUpdateValue={mockOnUpdateValue} />);
  expect(screen.queryByText("Name")).not.toBeOnTheScreen();
});

it("calls onUpdateValue with the new text as the user types", async () => {
  await render(<Input value="" onUpdateValue={mockOnUpdateValue} testID="name-input" />);
  await fireEvent.changeText(screen.getByTestId("name-input"), "Jane");
  expect(mockOnUpdateValue).toHaveBeenCalledWith("Jane");
});

it("shows the error message only when one is given", async () => {
  await render(<Input value="" onUpdateValue={mockOnUpdateValue} />);
  expect(screen.queryByText("Required")).not.toBeOnTheScreen();

  await render(<Input value="" onUpdateValue={mockOnUpdateValue} error="Required" />);
  expect(screen.getByText("Required")).toBeOnTheScreen();
});

it("shows an icon only when one is given", async () => {
  await render(<Input value="" onUpdateValue={mockOnUpdateValue} />);
  expect(screen.queryByTestId("icon-mail-outline")).not.toBeOnTheScreen();

  await render(<Input value="" onUpdateValue={mockOnUpdateValue} icon="mail-outline" />);
  expect(screen.getByTestId("icon-mail-outline")).toBeOnTheScreen();
});

it("shows the bird SVG only when birdSvg is set", async () => {
  await render(<Input value="" onUpdateValue={mockOnUpdateValue} />);
  expect(screen.queryByTestId("bird-svg")).not.toBeOnTheScreen();

  await render(<Input value="" onUpdateValue={mockOnUpdateValue} birdSvg />);
  expect(screen.getByTestId("bird-svg")).toBeOnTheScreen();
});

describe("secure text entry", () => {
  it("does not show a visibility toggle unless secure is set", async () => {
    await render(<Input value="" onUpdateValue={mockOnUpdateValue} testID="pw" />);
    expect(screen.queryByTestId("pw-toggle-visibility")).not.toBeOnTheScreen();
  });

  it("starts masked and toggles visibility on press", async () => {
    await render(<Input value="secret" onUpdateValue={mockOnUpdateValue} secure testID="pw" />);
    expect(screen.getByTestId("pw").props.secureTextEntry).toBe(true);
    expect(screen.getByTestId("icon-eye-off-outline")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("pw-toggle-visibility"));
    expect(screen.getByTestId("pw").props.secureTextEntry).toBe(false);
    expect(screen.getByTestId("icon-eye-outline")).toBeOnTheScreen();
  });
});
