jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      error100: "#fee",
      error600: "#900",
      textMain: "#000",
      textMiddle: "#666",
    },
  }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// @expo/vector-icons pulls in expo-font -> expo-asset, which isn't resolvable
// from this project's node_modules layout (it only exists nested under
// expo/node_modules) — stub the one icon this component renders rather than
// pulling in that whole chain.
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import FailedEditBanner from "../FailedEditBanner";

const failedEdit = { message: "Something broke", createdAt: 1 };

it("renders the failure message", async () => {
  await render(
    <FailedEditBanner failedEdit={failedEdit} onRetry={jest.fn()} onDiscard={jest.fn()} />,
  );
  expect(screen.getByText("Something broke")).toBeOnTheScreen();
});

it("falls back to a generic message when none is provided", async () => {
  await render(
    <FailedEditBanner
      failedEdit={{ message: null, createdAt: 1 }}
      onRetry={jest.fn()}
      onDiscard={jest.fn()}
    />,
  );
  expect(screen.getByText("edit_not_saved_message")).toBeOnTheScreen();
});

it("calls onDiscard synchronously when the discard button is tapped", async () => {
  const onDiscard = jest.fn();
  await render(
    <FailedEditBanner failedEdit={failedEdit} onRetry={jest.fn()} onDiscard={onDiscard} />,
  );

  fireEvent.press(screen.getByText("discard_changes"));

  expect(onDiscard).toHaveBeenCalledTimes(1);
});

it("shows a spinner while retrying, then restores the label once resolved", async () => {
  let resolveRetry!: () => void;
  const onRetry = jest.fn(
    () => new Promise<void>((resolve) => {
      resolveRetry = resolve;
    }),
  );
  await render(
    <FailedEditBanner failedEdit={failedEdit} onRetry={onRetry} onDiscard={jest.fn()} />,
  );

  fireEvent.press(screen.getByText("try_again"));
  expect(onRetry).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByText("try_again")).not.toBeOnTheScreen());

  await act(async () => {
    resolveRetry();
    await Promise.resolve();
  });

  await waitFor(() => expect(screen.getByText("try_again")).toBeOnTheScreen());
});
