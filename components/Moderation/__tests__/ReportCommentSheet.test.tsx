jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const { View, TextInput } = require("react-native");
  return { BottomSheetView: View, BottomSheetTextInput: TextInput };
});

import { fireEvent, render, screen } from "@testing-library/react-native";

import ReportCommentSheet from "../ReportCommentSheet";

const mockDismiss = jest.fn();
const mockOnSubmit = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

const renderSheet = () =>
  render(<ReportCommentSheet dismiss={mockDismiss} onSubmit={mockOnSubmit} />);

const type = async (text: string) =>
  fireEvent.changeText(screen.getByTestId("report-comment-input"), text);

it("will not send an empty explanation — that is the whole point of asking", async () => {
  await renderSheet();

  await fireEvent.press(screen.getByTestId("report-comment-submit"));

  expect(mockOnSubmit).not.toHaveBeenCalled();
});

it("treats whitespace as empty", async () => {
  await renderSheet();

  await type("   ");
  await fireEvent.press(screen.getByTestId("report-comment-submit"));

  expect(mockOnSubmit).not.toHaveBeenCalled();
});

it("sends the trimmed text", async () => {
  await renderSheet();

  await type("  the photo is not a bird  ");
  await fireEvent.press(screen.getByTestId("report-comment-submit"));

  expect(mockOnSubmit).toHaveBeenCalledWith("the photo is not a bird");
});

it("caps the input at what the server accepts", async () => {
  await renderSheet();

  expect(screen.getByTestId("report-comment-input").props.maxLength).toBe(1000);
});

it("closes without reporting anything on cancel", async () => {
  await renderSheet();

  await type("changed my mind");
  await fireEvent.press(screen.getByTestId("report-comment-cancel"));

  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockOnSubmit).not.toHaveBeenCalled();
});
