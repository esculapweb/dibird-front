jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
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
jest.mock("../../../store/profile-context", () => ({ useProfile: jest.fn() }));
jest.mock("../../../hooks/Profile/useUpdateProfile", () => ({
  useInvalidateProfile: () => mockInvalidateProfile,
}));
jest.mock("../../../hooks/useMediaLibraryUnavailable", () => ({
  useMediaLibraryUnavailable: () => mockHandleMediaLibraryUnavailable,
}));
jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("../../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn(), showMenu: jest.fn() },
}));
jest.mock("../../../hooks/repositories/profileRepository", () => ({
  queuePendingAvatar: jest.fn(),
}));
jest.mock("../../../services/sync/avatarSync", () => ({ runAvatarSync: jest.fn() }));
jest.mock("expo-image-picker", () => ({
  getMediaLibraryPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///docs/",
  copyAsync: jest.fn(),
}));

const mockProfileAvatarCapture = jest.fn();
jest.mock("../ProfileAvatar", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockProfileAvatarCapture(props);
    return null;
  },
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { useProfile } from "../../../store/profile-context";
import { BottomSheet } from "../../../services/bottomSheet";
import * as profileRepository from "../../../hooks/repositories/profileRepository";
import * as avatarSync from "../../../services/sync/avatarSync";
import Avatar from "../Avatar";

const mockInvalidateProfile = jest.fn();
const mockHandleMediaLibraryUnavailable = jest.fn();
const mockShowErrorToast = jest.fn();

const mockProfile = (overrides: Record<string, unknown> = {}) => {
  (useProfile as jest.Mock).mockReturnValue({
    profile: {
      user_data: { first_name: "Jane", last_name: "Doe", username: "jane" },
      avatar_thumbnail: null,
      pendingAvatarOp: null,
      pendingAvatarUri: null,
      ...overrides,
    },
  });
};

const avatarProps = () => mockProfileAvatarCapture.mock.calls.at(-1)![0] as { avatar: string | null };

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile();
  (ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///picked.jpg" }],
  });
  (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({ uri: "file:///manipulated.jpg" });
  (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
  (avatarSync.runAvatarSync as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(Date, "now").mockReturnValue(1234567890);
});

describe("avatar source resolution from profile", () => {
  it("uses avatar_thumbnail with no pending op", async () => {
    mockProfile({ avatar_thumbnail: "avatars/1.jpg" });
    await render(<Avatar />);
    expect(avatarProps().avatar).toBe("avatars/1.jpg");
  });

  it("uses pendingAvatarUri while an upload is pending", async () => {
    mockProfile({ avatar_thumbnail: "avatars/1.jpg", pendingAvatarOp: "upload", pendingAvatarUri: "file:///pending.jpg" });
    await render(<Avatar />);
    expect(avatarProps().avatar).toBe("file:///pending.jpg");
  });

  it("shows no avatar while a delete is pending, even if avatar_thumbnail is still set", async () => {
    mockProfile({ avatar_thumbnail: "avatars/1.jpg", pendingAvatarOp: "delete" });
    await render(<Avatar />);
    expect(avatarProps().avatar).toBeNull();
  });
});

describe("hint text", () => {
  it("shows the 'tap to add' hint only when there's no avatar and it's not loading", async () => {
    await render(<Avatar />);
    expect(screen.getByText("tap_to_add_photo", { exact: false })).toBeOnTheScreen();
  });

  it("hides the hint once an avatar is set", async () => {
    mockProfile({ avatar_thumbnail: "avatars/1.jpg" });
    await render(<Avatar />);
    expect(screen.queryByText("tap_to_add_photo", { exact: false })).not.toBeOnTheScreen();
  });
});

describe("tap behavior", () => {
  it("goes straight into pickAvatar (no menu) when there's no avatar yet", async () => {
    await render(<Avatar />);
    await fireEvent.press(screen.getByTestId("icon-pencil"));
    expect(BottomSheet.showMenu).not.toHaveBeenCalled();
    expect(ImagePicker.getMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("opens a change/remove menu when an avatar is already set", async () => {
    mockProfile({ avatar_thumbnail: "avatars/1.jpg" });
    await render(<Avatar />);
    await fireEvent.press(screen.getByTestId("icon-pencil"));

    expect(BottomSheet.showMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({ label: "change_photo" }),
          expect.objectContaining({ label: "remove_photo", danger: true }),
        ],
      }),
    );
  });

  it("wires the remove-photo menu item to a confirm sheet that calls removeAvatar", async () => {
    mockProfile({ avatar_thumbnail: "avatars/1.jpg" });
    await render(<Avatar />);
    await fireEvent.press(screen.getByTestId("icon-pencil"));

    const items = (BottomSheet.showMenu as jest.Mock).mock.calls[0][0].items;
    await act(async () => items[1].onPress());

    expect(BottomSheet.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "remove_title", danger: true }),
    );

    const confirmPayload = (BottomSheet.show as jest.Mock).mock.calls[0][0];
    await act(async () => confirmPayload.onConfirm());

    expect(profileRepository.queuePendingAvatar).toHaveBeenCalledWith("delete", null);
    expect(avatarSync.runAvatarSync).toHaveBeenCalledTimes(1);
    expect(mockInvalidateProfile).toHaveBeenCalledTimes(1);
  });
});

describe("pickAvatar permission handling", () => {
  it("bails out to the unavailable sheet when permission was already denied", async () => {
    (ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });
    await render(<Avatar />);
    await fireEvent.press(screen.getByTestId("icon-pencil"));
    await act(async () => Promise.resolve());

    expect(mockHandleMediaLibraryUnavailable).toHaveBeenCalledTimes(1);
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("requests permission when undetermined, and stops if the user declines", async () => {
    (ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined" });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });
    await render(<Avatar />);
    await fireEvent.press(screen.getByTestId("icon-pencil"));
    await act(async () => Promise.resolve());

    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("proceeds to the picker once the requested permission is granted", async () => {
    (ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined" });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    await render(<Avatar />);
    await fireEvent.press(screen.getByTestId("icon-pencil"));
    await act(async () => Promise.resolve());

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });
});

describe("pickAvatar result handling", () => {
  it("does nothing further when the picker is canceled", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    await render(<Avatar />);
    await fireEvent.press(screen.getByTestId("icon-pencil"));
    await act(async () => Promise.resolve());

    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  });

  it("manipulates, persists outside the cache dir, queues the pending upload, and syncs on success", async () => {
    await render(<Avatar />);
    await fireEvent.press(screen.getByTestId("icon-pencil"));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      "file:///picked.jpg",
      [],
      { compress: 0.8, format: "jpeg" },
    );
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: "file:///manipulated.jpg",
      to: "file:///docs/pending-avatar-1234567890.jpg",
    });
    expect(profileRepository.queuePendingAvatar).toHaveBeenCalledWith(
      "upload",
      "file:///docs/pending-avatar-1234567890.jpg",
    );
    expect(avatarSync.runAvatarSync).toHaveBeenCalledTimes(1);
    expect(mockInvalidateProfile).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when something in the pipeline throws", async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValue(new Error("boom"));
    await render(<Avatar />);
    await fireEvent.press(screen.getByTestId("icon-pencil"));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());

    expect(mockShowErrorToast).toHaveBeenCalledWith(expect.any(Error), "AvatarUpload");
  });
});
