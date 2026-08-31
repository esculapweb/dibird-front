// Picking photos for an observation. Two things matter beyond "it opens the
// picker": the gallery is the only source (the camera permission is blocked in
// app.config.js, so a capture would need a new native build), and the selection
// limit has to match what the server accepts, or the user picks a photo that is
// then rejected.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count != null ? `${key}:${options.count}` : key,
  }),
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
jest.mock("../../../hooks/useMediaLibraryUnavailable", () => ({
  useMediaLibraryUnavailable: () => mockHandleMediaLibraryUnavailable,
}));
jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("../../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn(), showMenu: jest.fn() },
}));
jest.mock("expo-image-picker", () => ({
  getMediaLibraryPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));

const mockHandleMediaLibraryUnavailable = jest.fn();
const mockShowErrorToast = jest.fn();
const mockStripCapture = jest.fn();
jest.mock("../ObservationPhotos", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockStripCapture(props);
    return null;
  },
}));

import { act, render } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import ObservationPhotoPicker from "../ObservationPhotoPicker";
import { BottomSheet } from "../../../services/bottomSheet";
import { MAX_OBSERVATION_PHOTOS } from "../../../constants/config";
import { ObservationPhoto } from "../../../types";

const getPermissions = ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock;
const requestPermissions = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const manipulate = ImageManipulator.manipulateAsync as jest.Mock;

const photo = (id: number): ObservationPhoto => ({
  id,
  image: "x.jpg",
  thumbnail: "t.jpg",
  sort_order: 0,
  created_at: "2026-01-01T00:00:00Z",
});

const mockOnPicked = jest.fn();
const mockOnRemove = jest.fn();

const renderPicker = async (photos: ObservationPhoto[] = []) => {
  await act(async () => {
    render(
      <ObservationPhotoPicker
        photos={photos}
        onPicked={mockOnPicked}
        onRemove={mockOnRemove}
      />,
    );
  });
  return mockStripCapture.mock.calls[mockStripCapture.mock.calls.length - 1][0];
};

const press = async (props: Record<string, unknown>) => {
  await act(async () => {
    await (props.onAdd as () => Promise<void>)();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  getPermissions.mockResolvedValue({ status: "granted" });
  launchLibrary.mockResolvedValue({ canceled: true, assets: null });
  manipulate.mockImplementation(async (uri: string) => ({ uri: `${uri}-small` }));
});

it("opens the settings sheet instead of the picker when access was denied", async () => {
  getPermissions.mockResolvedValue({ status: "denied" });
  const props = await renderPicker();

  await press(props);

  expect(mockHandleMediaLibraryUnavailable).toHaveBeenCalledTimes(1);
  expect(launchLibrary).not.toHaveBeenCalled();
});

it("asks for permission when it has not been decided yet, and stops if refused", async () => {
  getPermissions.mockResolvedValue({ status: "undetermined" });
  requestPermissions.mockResolvedValue({ status: "denied" });
  const props = await renderPicker();

  await press(props);

  expect(requestPermissions).toHaveBeenCalledTimes(1);
  expect(launchLibrary).not.toHaveBeenCalled();
});

it("picks from the gallery only, never the camera", async () => {
  const props = await renderPicker();

  await press(props);

  expect(launchLibrary).toHaveBeenCalledWith(
    expect.objectContaining({ mediaTypes: ["images"], allowsMultipleSelection: true }),
  );
  // allowsEditing is mutually exclusive with multiple selection.
  expect(launchLibrary.mock.calls[0][0]).not.toHaveProperty("allowsEditing");
  // And no `quality`: every asset is re-encoded by the manipulator below, so
  // asking the picker to encode a JPEG first only loses quality twice.
  expect(launchLibrary.mock.calls[0][0]).not.toHaveProperty("quality");
});

it("limits the selection to what is left of the server's quota", async () => {
  const props = await renderPicker([photo(1), photo(2)]);

  await press(props);

  expect(launchLibrary).toHaveBeenCalledWith(
    expect.objectContaining({ selectionLimit: MAX_OBSERVATION_PHOTOS - 2 }),
  );
});

it("disables the add tile once the limit is reached", async () => {
  const props = await renderPicker(
    Array.from({ length: MAX_OBSERVATION_PHOTOS }, (_, i) => photo(i + 1)),
  );

  expect(props.addDisabled).toBe(true);
});

it("hands compressed copies to the caller, one per picked asset", async () => {
  launchLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///a.jpg" }, { uri: "file:///b.jpg" }],
  });
  const props = await renderPicker();

  await press(props);

  expect(manipulate).toHaveBeenCalledTimes(2);
  expect(mockOnPicked).toHaveBeenCalledWith(["file:///a.jpg-small", "file:///b.jpg-small"]);
});

it("does nothing when the picker comes back empty", async () => {
  // iOS "limited photo access" can grant permission and still return nothing.
  launchLibrary.mockResolvedValue({ canceled: false, assets: [] });
  const props = await renderPicker();

  await press(props);

  expect(mockOnPicked).not.toHaveBeenCalled();
});

it("asks for confirmation before removing a photo", async () => {
  const target = photo(7);
  const props = await renderPicker([target]);

  (props.onRemove as (p: ObservationPhoto) => void)(target);

  expect(mockOnRemove).not.toHaveBeenCalled();
  expect(BottomSheet.show).toHaveBeenCalledWith(
    expect.objectContaining({ danger: true }),
  );
  (BottomSheet.show as jest.Mock).mock.calls[0][0].onConfirm();
  expect(mockOnRemove).toHaveBeenCalledWith(target);
});

it("surfaces a picker failure as a toast rather than crashing the form", async () => {
  launchLibrary.mockRejectedValue(new Error("picker exploded"));
  const props = await renderPicker();

  await press(props);

  expect(mockShowErrorToast).toHaveBeenCalled();
});
