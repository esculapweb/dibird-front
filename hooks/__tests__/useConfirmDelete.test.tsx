jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn() },
}));
jest.mock("../useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));

import { renderHook } from "@testing-library/react-native";
import { BottomSheet } from "../../services/bottomSheet";
import { useConfirmDelete } from "../useConfirmDelete";

const mockShowErrorToast = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

const openSheet = async (runDelete: jest.Mock) => {
  const { result } = await renderHook(() => useConfirmDelete());
  result.current({ message: "delete_place_message", runDelete, tag: "tag:1" });
  return (BottomSheet.show as jest.Mock).mock.calls[0][0];
};

it("shows the danger confirm sheet with the given message and deletes nothing yet", async () => {
  const runDelete = jest.fn();
  const sheet = await openSheet(runDelete);

  expect(sheet).toEqual(
    expect.objectContaining({
      title: "delete_title",
      description: "delete_place_message",
      confirmText: "delete",
      cancelText: "cancel",
      danger: true,
    }),
  );
  expect(runDelete).not.toHaveBeenCalled();
});

it("resolves onConfirm once the delete succeeds", async () => {
  const runDelete = jest.fn((callbacks) => callbacks.onSuccess());
  const sheet = await openSheet(runDelete);

  await expect(sheet.onConfirm()).resolves.toBeUndefined();
  expect(runDelete).toHaveBeenCalledTimes(1);
  expect(mockShowErrorToast).not.toHaveBeenCalled();
});

// The delete mutations' wrapper has already toasted an ordinary failure.
it("still resolves on failure, leaving an ordinary error to the mutation's toast", async () => {
  const runDelete = jest.fn((callbacks) => callbacks.onError(new Error("boom")));
  const sheet = await openSheet(runDelete);

  await expect(sheet.onConfirm()).resolves.toBeUndefined();
  expect(mockShowErrorToast).not.toHaveBeenCalled();
});

it("reports a validation error, which the wrapper leaves to the caller", async () => {
  const error = { status: 400, response: { data: { detail: "nope" } } };
  const runDelete = jest.fn((callbacks) => callbacks.onError(error));
  const sheet = await openSheet(runDelete);

  await expect(sheet.onConfirm()).resolves.toBeUndefined();
  expect(mockShowErrorToast).toHaveBeenCalledWith(error, "tag:1");
});
