jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock("../../store/onboarding-context", () => ({ useOnboarding: jest.fn() }));
jest.mock("../../services/bottomSheet", () => ({ BottomSheet: { show: jest.fn() } }));
jest.mock("../../util/storageHelper", () => ({
  isProfileReviewPending: jest.fn(),
  clearProfileReviewPending: jest.fn(async () => {}),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useOnboarding } from "../../store/onboarding-context";
import { BottomSheet } from "../../services/bottomSheet";
import { clearProfileReviewPending, isProfileReviewPending } from "../../util/storageHelper";
import { useProfileReviewPrompt } from "../useProfileReviewPrompt";

const setStatus = (status: string) =>
  (useOnboarding as jest.Mock).mockReturnValue({ status });

beforeEach(() => {
  jest.clearAllMocks();
  setStatus("done");
  (isProfileReviewPending as jest.Mock).mockResolvedValue(true);
});

// #149: a new account comes with a name and country filled in for the person
// and privacy defaults they never chose — one trip to the profile, once.
it("offers the profile once after the onboarding, and forgets the flag first", async () => {
  await renderHook(() => useProfileReviewPrompt());
  await act(async () => {});

  expect(clearProfileReviewPending).toHaveBeenCalledTimes(1);
  expect(BottomSheet.show).toHaveBeenCalledTimes(1);
  const sheet = (BottomSheet.show as jest.Mock).mock.calls[0][0];
  expect(sheet).toMatchObject({
    title: "profile_review_title",
    description: "profile_review_text",
    confirmText: "profile_review_open",
    cancelText: "profile_review_later",
  });

  sheet.onConfirm();
  expect(mockNavigate).toHaveBeenCalledWith("Profile");
});

it("waits while the onboarding is still on screen", async () => {
  setStatus("needed");
  const { rerender } = await renderHook(() => useProfileReviewPrompt());
  await act(async () => {});
  expect(BottomSheet.show).not.toHaveBeenCalled();

  setStatus("done");
  await rerender({});
  await act(async () => {});
  expect(BottomSheet.show).toHaveBeenCalledTimes(1);
});

it("stays quiet for an existing account", async () => {
  (isProfileReviewPending as jest.Mock).mockResolvedValue(false);
  await renderHook(() => useProfileReviewPrompt());
  await act(async () => {});

  expect(BottomSheet.show).not.toHaveBeenCalled();
  expect(clearProfileReviewPending).not.toHaveBeenCalled();
});

it("does not ask twice on re-renders", async () => {
  const { rerender } = await renderHook(() => useProfileReviewPrompt());
  await act(async () => {});
  await rerender({});
  await act(async () => {});

  expect(isProfileReviewPending).toHaveBeenCalledTimes(1);
});
