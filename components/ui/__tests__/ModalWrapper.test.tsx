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

const mockModalCapture = jest.fn();
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  return new Proxy(actual, {
    get(target, prop, receiver) {
      if (prop === "Modal") {
        return (props: {
          visible: boolean;
          children?: import("react").ReactNode;
          onRequestClose?: () => void;
        }) => {
          mockModalCapture(props);
          const { View } = actual;
          return props.visible ? <View testID="modal-root">{props.children}</View> : null;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import ModalWrapper from "../ModalWrapper";

const mockOnClose = jest.fn();
const mockOnApply = jest.fn();
const mockOnSort = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders nothing while not visible", async () => {
  await render(
    <ModalWrapper visible={false} onClose={mockOnClose}>
      <Text>body</Text>
    </ModalWrapper>,
  );
  expect(screen.queryByTestId("modal-root")).not.toBeOnTheScreen();
  expect(screen.queryByText("body")).not.toBeOnTheScreen();
});

it("renders the children and a close button while visible", async () => {
  await render(
    <ModalWrapper visible onClose={mockOnClose}>
      <Text>body</Text>
    </ModalWrapper>,
  );
  expect(screen.getByText("body")).toBeOnTheScreen();
  expect(screen.getByText("close-circle")).toBeOnTheScreen();
});

it("closes when the close button is pressed", async () => {
  await render(
    <ModalWrapper visible onClose={mockOnClose}>
      <Text>body</Text>
    </ModalWrapper>,
  );
  await fireEvent.press(screen.getByText("close-circle"));
  expect(mockOnClose).toHaveBeenCalledTimes(1);
});

it("wires onClose to the native onRequestClose (Android back / swipe)", async () => {
  await render(
    <ModalWrapper visible onClose={mockOnClose}>
      <Text>body</Text>
    </ModalWrapper>,
  );
  mockModalCapture.mock.calls.at(-1)![0].onRequestClose();
  expect(mockOnClose).toHaveBeenCalledTimes(1);
});

it("shows the title only when given", async () => {
  const { rerender } = await render(
    <ModalWrapper visible onClose={mockOnClose}>
      <Text>body</Text>
    </ModalWrapper>,
  );
  expect(screen.queryByText("Filters")).not.toBeOnTheScreen();

  await rerender(
    <ModalWrapper visible onClose={mockOnClose} title="Filters">
      <Text>body</Text>
    </ModalWrapper>,
  );
  expect(screen.getByText("Filters")).toBeOnTheScreen();
});

describe("sort icon", () => {
  it("is hidden unless both showSortIcon and onSort are given", async () => {
    const { rerender } = await render(
      <ModalWrapper visible onClose={mockOnClose} showSortIcon>
        <Text>body</Text>
      </ModalWrapper>,
    );
    expect(screen.queryByText("swap-vertical")).not.toBeOnTheScreen();

    await rerender(
      <ModalWrapper visible onClose={mockOnClose} onSort={mockOnSort}>
        <Text>body</Text>
      </ModalWrapper>,
    );
    expect(screen.queryByText("swap-vertical")).not.toBeOnTheScreen();

    await rerender(
      <ModalWrapper visible onClose={mockOnClose} showSortIcon onSort={mockOnSort}>
        <Text>body</Text>
      </ModalWrapper>,
    );
    expect(screen.getByText("swap-vertical")).toBeOnTheScreen();
  });

  it("calls onSort when pressed", async () => {
    await render(
      <ModalWrapper visible onClose={mockOnClose} showSortIcon onSort={mockOnSort}>
        <Text>body</Text>
      </ModalWrapper>,
    );
    await fireEvent.press(screen.getByText("swap-vertical"));
    expect(mockOnSort).toHaveBeenCalledTimes(1);
  });
});

describe("apply icon", () => {
  it("is hidden without onApply, shown and wired when given", async () => {
    const { rerender } = await render(
      <ModalWrapper visible onClose={mockOnClose}>
        <Text>body</Text>
      </ModalWrapper>,
    );
    expect(screen.queryByText("checkmark-circle")).not.toBeOnTheScreen();

    await rerender(
      <ModalWrapper visible onClose={mockOnClose} onApply={mockOnApply}>
        <Text>body</Text>
      </ModalWrapper>,
    );
    await fireEvent.press(screen.getByText("checkmark-circle"));
    expect(mockOnApply).toHaveBeenCalledTimes(1);
  });
});
