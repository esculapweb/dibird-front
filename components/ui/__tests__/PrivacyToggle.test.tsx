jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import PrivacyToggle from "../PrivacyToggle";

const mockOnChange = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("read-only (no onChange)", () => {
  it("shows the public label/description and no Switch", async () => {
    await render(<PrivacyToggle value={false} testID="privacy" />);
    expect(screen.getByText("Public")).toBeOnTheScreen();
    expect(screen.getByText("Visible to everyone")).toBeOnTheScreen();
    expect(screen.queryByTestId("privacy-switch")).toBeNull();
  });

  it("is disabled since there's no onChange to fire", async () => {
    await render(<PrivacyToggle value={false} testID="privacy" />);
    expect(screen.getByTestId("privacy").props.accessibilityState.disabled).toBe(true);
  });
});

describe("interactive (with onChange)", () => {
  it("shows the private label/description and a Switch when value is true", async () => {
    await render(<PrivacyToggle value onChange={mockOnChange} testID="privacy" />);
    expect(screen.getByText("Private")).toBeOnTheScreen();
    expect(screen.getByText("Only you can see this")).toBeOnTheScreen();
    expect(screen.getByTestId("privacy-switch")).toBeOnTheScreen();
  });

  it("is enabled and toggles onChange when the row itself is pressed", async () => {
    await render(<PrivacyToggle value={false} onChange={mockOnChange} testID="privacy" />);
    expect(screen.getByTestId("privacy").props.accessibilityState.disabled).toBeFalsy();

    await fireEvent.press(screen.getByTestId("privacy"));
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it("toggles onChange when the Switch is flipped directly", async () => {
    await render(<PrivacyToggle value={false} onChange={mockOnChange} testID="privacy" />);
    fireEvent(screen.getByTestId("privacy-switch"), "valueChange", true);
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });
});

describe("disabled prop", () => {
  it("disables the row even when onChange is provided", async () => {
    await render(<PrivacyToggle value={false} onChange={mockOnChange} disabled testID="privacy" />);
    expect(screen.getByTestId("privacy").props.accessibilityState.disabled).toBe(true);
  });
});

describe("descriptionType label sets", () => {
  it.each([
    ["male", "Private", "Public"],
    ["multiple", "Private", "Public"],
    ["location", "Private location", "Shared location"],
    [undefined, "Private", "Public"],
  ])("uses the %s label set", async (descriptionType, privateLabel, publicLabel) => {
    const { rerender } = await render(
      <PrivacyToggle value={false} descriptionType={descriptionType} />,
    );
    expect(screen.getByText(publicLabel)).toBeOnTheScreen();

    await rerender(<PrivacyToggle value descriptionType={descriptionType} />);
    expect(screen.getByText(privateLabel)).toBeOnTheScreen();
  });
});
