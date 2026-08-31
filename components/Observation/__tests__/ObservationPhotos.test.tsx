// The strip renders in two modes from one component, and the difference is
// what these cover: the detail screens get read-only 150 pt squares with a
// caption that tells them apart from the species reference shot in the header,
// while the form's picker keeps the small tiles and no caption of its own.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
const mockShowMenu = jest.fn();
jest.mock("../../../services/bottomSheet", () => ({
  BottomSheet: { showMenu: (payload: unknown) => mockShowMenu(payload) },
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
const mockViewerCapture = jest.fn();
jest.mock("../../ui/PhotoViewerModal", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockViewerCapture(props);
    return null;
  },
}));

import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import ObservationPhotos from "../ObservationPhotos";
import { ObservationPhoto } from "../../../types";

const photo = (id: number): ObservationPhoto => ({
  id,
  image: `obs/${id}.jpg`,
  thumbnail: `obs/${id}.thumb.jpg`,
  sort_order: id,
  created_at: "2026-01-01T00:00:00Z",
});

const photos = (count: number) =>
  Array.from({ length: count }, (_, i) => photo(i + 1));

describe("ObservationPhotos", () => {
  it("captions the read-only strip so it is not read as the species photo", async () => {
    await render(<ObservationPhotos photos={photos(1)} />);

    expect(screen.getByTestId("observation-photos-caption")).toBeOnTheScreen();
    expect(screen.getByText("observation_photos_title")).toBeOnTheScreen();
    expect(screen.getByText("observation_photos_note")).toBeOnTheScreen();
  });

  it("leaves the caption out of the picker, which has its own section header", async () => {
    await render(
      <ObservationPhotos photos={photos(1)} onAdd={jest.fn()} onRemove={jest.fn()} />,
    );

    expect(screen.queryByTestId("observation-photos-caption")).toBeNull();
  });

  it.each([1, 3, 5])(
    "keeps the read-only tile at 150 pt for %i photo(s)",
    async (count) => {
      await render(<ObservationPhotos photos={photos(count)} />);

      const tiles = Array.from({ length: count }, (_, i) =>
        screen.getByTestId(`observation-photo-tile-${i}`),
      );

      tiles.forEach((tile) => {
        const style = StyleSheet.flatten(tile.props.style);
        expect(style.width).toBe(150);
        expect(style.height).toBe(150);
      });
    },
  );

  it("keeps the editing tile small, where the row also carries add and remove", async () => {
    await render(
      <ObservationPhotos photos={photos(1)} onAdd={jest.fn()} onRemove={jest.fn()} />,
    );

    const style = StyleSheet.flatten(
      screen.getByTestId("observation-photo-tile-0").props.style,
    );
    expect(style.width).toBe(88);
  });

  describe("reporting someone else's photo", () => {
    const viewerProps = () => mockViewerCapture.mock.calls.at(-1)![0];

    const openViewer = async (onReport: () => void) => {
      await render(<ObservationPhotos photos={photos(2)} onReport={onReport} />);
      await fireEvent.press(screen.getByTestId("observation-photo-tile-1"));
      expect(viewerProps().visible).toBe(true);
    };

    it("closes the viewer before offering the menu", async () => {
      const onReport = jest.fn();
      await openViewer(onReport);

      await act(async () => viewerProps().onMorePress(1));

      // The viewer is a native Modal in its own window and the app's bottom
      // sheet lives under it: leave it open and the menu is invisible, which
      // reads as the button doing nothing.
      expect(viewerProps().visible).toBe(false);
      expect(mockShowMenu).toHaveBeenCalledTimes(1);
    });

    it("reports the photo that was on screen", async () => {
      const onReport = jest.fn();
      await openViewer(onReport);

      await act(async () => viewerProps().onMorePress(1));
      const { items } = mockShowMenu.mock.calls.at(-1)![0];
      items[0].onPress();

      expect(items[0].label).toBe("report_photo");
      expect(onReport).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    });

    it("offers no menu when the screen passes no report handler", async () => {
      await render(<ObservationPhotos photos={photos(1)} />);

      expect(viewerProps().onMorePress).toBeUndefined();
    });
  });
});
