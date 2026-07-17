jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

import { Linking } from "react-native";
import Toast from "react-native-toast-message";
import { openSupportEmail } from "../openSupportEmail";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "canOpenURL");
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("opens a mailto: link with the support address and subject when a mail app is available", async () => {
  (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
  await openSupportEmail();

  expect(Linking.openURL).toHaveBeenCalledWith(
    expect.stringMatching(/^mailto:.*support%20request/i),
  );
  expect(Toast.show).not.toHaveBeenCalled();
});

it("shows an error toast instead of opening the URL when no mail app can handle it", async () => {
  (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);
  await openSupportEmail();

  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "error",
      text1: "No Mail App",
      text2: "Please contact us at admin@dibird.com",
    }),
  );
});

it("shows the same error toast if canOpenURL itself throws", async () => {
  (Linking.canOpenURL as jest.Mock).mockRejectedValue(new Error("boom"));
  await openSupportEmail();

  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "error",
      text1: "No Mail App",
      text2: "Please contact us at admin@dibird.com",
    }),
  );
});

it("shows the error toast if openURL itself throws after a successful canOpenURL check", async () => {
  (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
  (Linking.openURL as jest.Mock).mockRejectedValue(new Error("boom"));
  await openSupportEmail();

  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "error",
      text1: "No Mail App",
      text2: "Please contact us at admin@dibird.com",
    }),
  );
});
