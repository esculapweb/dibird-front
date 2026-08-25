jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));

import { Linking } from "react-native";
import Toast from "react-native-toast-message";

import { track } from "../../services/analytics";
import i18n from "../../services/i18n";
import { openDonatePage } from "../openDonatePage";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  // logError writes the failed open to the console under __DEV__.
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  jest.restoreAllMocks();
  await i18n.changeLanguage("en");
});

it("opens the donation page of the site", async () => {
  await openDonatePage("settings");

  expect(Linking.openURL).toHaveBeenCalledWith(
    expect.stringMatching(/\/page\/donate\/$/),
  );
  expect(Toast.show).not.toHaveBeenCalled();
});

it("opens the russian version for a russian UI", async () => {
  // The page is a localised URL, not a language header: /page/donate/ is the
  // english one, the russian text lives under the /ru/ prefix.
  await i18n.changeLanguage("ru");
  await openDonatePage("settings");

  expect(Linking.openURL).toHaveBeenCalledWith(
    expect.stringContaining("/ru/page/donate/"),
  );
});

it("reports the entry point to analytics", async () => {
  await openDonatePage("settings");

  expect(track).toHaveBeenCalledWith("donate_tapped", { source: "settings" });
});

it("shows an error toast when no browser takes the link", async () => {
  (Linking.openURL as jest.Mock).mockRejectedValue(new Error("boom"));

  await openDonatePage("settings");

  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: "error" }),
  );
});
