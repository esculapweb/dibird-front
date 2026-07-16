jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      toastSuccess: "#0a0",
      toastError: "#f00",
      toastInfo: "#00f",
      primary100: "#fff",
      toastBorder: "#ccc",
      textMain: "#000",
      textSecondary: "#666",
    },
  }),
}));

const mockBaseToastCapture = jest.fn();
jest.mock("react-native-toast-message", () => ({
  BaseToast: (props: Record<string, unknown>) => {
    mockBaseToastCapture(props);
    return null;
  },
}));

import { render } from "@testing-library/react-native";
import ThemedToast from "../ThemedToast";

beforeEach(() => {
  jest.clearAllMocks();
});

describe.each([
  ["success", "#0a0"],
  ["error", "#f00"],
  ["info", "#00f"],
] as const)("%s variant", (variant, expectedBorderColor) => {
  it(`uses the ${variant} theme color for the left border`, async () => {
    const Toast = ThemedToast[variant];
    await render(<Toast text1="Hello" text2="World" />);

    expect(mockBaseToastCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({ borderLeftColor: expectedBorderColor }),
      }),
    );
  });

  it("forwards incoming props (e.g. text1/text2) through to BaseToast", async () => {
    const Toast = ThemedToast[variant];
    await render(<Toast text1="Hello" text2="World" />);

    expect(mockBaseToastCapture).toHaveBeenCalledWith(
      expect.objectContaining({ text1: "Hello", text2: "World" }),
    );
  });
});

it("shares the same background/border styling across all three variants", async () => {
  const Success = ThemedToast.success;
  const Info = ThemedToast.info;

  await render(<Success text1="a" />);
  const successProps = mockBaseToastCapture.mock.calls.at(-1)![0];

  mockBaseToastCapture.mockClear();
  await render(<Info text1="a" />);
  const infoProps = mockBaseToastCapture.mock.calls.at(-1)![0];

  expect(successProps.style.backgroundColor).toBe(infoProps.style.backgroundColor);
  expect(successProps.contentContainerStyle).toEqual(infoProps.contentContainerStyle);
});
