jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));
jest.mock("../helpers", () => ({
  buildShareUrl: jest.fn(
    (path: string, filters: unknown, sort: unknown) =>
      `https://x/${path}${filters || sort ? "?share=1" : ""}`,
  ),
}));

import { Platform, Share } from "react-native";
import Toast from "react-native-toast-message";
import type { TFunction } from "i18next";
import { track } from "../../services/analytics";
import { buildShareUrl } from "../helpers";
import { shareDiary, shareObservation } from "../share";

const t = ((key: string) => key) as unknown as TFunction;
const originalOS = Platform.OS;

let shareSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
});

afterEach(() => {
  Platform.OS = originalOS;
});

describe("shareObservation", () => {
  it("explains instead of sharing a private observation", async () => {
    await shareObservation({ id: 1, private: true }, t);

    expect(Toast.show).toHaveBeenCalledWith({
      type: "info",
      text1: "observation_private",
      text2: "observation_private_share_hint",
    });
    expect(shareSpy).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("shares the community link as a url on iOS", async () => {
    Platform.OS = "ios";
    await shareObservation({ id: 7, private: false }, t);

    expect(shareSpy).toHaveBeenCalledWith({ url: "https://x/my/community/7/" });
    expect(track).toHaveBeenCalledWith("share_tapped", { type: "observation" });
  });

  it("shares it as the message on Android", async () => {
    Platform.OS = "android";
    await shareObservation({ id: 7 }, t);

    expect(shareSpy).toHaveBeenCalledWith({ message: "https://x/my/community/7/" });
  });
});

describe("shareDiary", () => {
  it("explains instead of sharing a private diary", async () => {
    await shareDiary({ id: 3, private: true }, t);

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: "diary_private", text2: "diary_private_share_hint" }),
    );
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it("passes the detail screen's filters and sort into the link", async () => {
    Platform.OS = "ios";
    const filters = { species: 5 } as never;
    await shareDiary({ id: 3 }, t, filters, "-date");

    expect(buildShareUrl).toHaveBeenCalledWith("my/diary/3/", filters, "-date");
    expect(shareSpy).toHaveBeenCalledWith({ url: "https://x/my/diary/3/?share=1" });
    expect(track).toHaveBeenCalledWith("share_tapped", { type: "diary" });
  });

  it("shares the bare link from a list row", async () => {
    Platform.OS = "android";
    await shareDiary({ id: 3 }, t);

    expect(buildShareUrl).toHaveBeenCalledWith("my/diary/3/", null, null);
    expect(shareSpy).toHaveBeenCalledWith({ message: "https://x/my/diary/3/" });
  });
});
