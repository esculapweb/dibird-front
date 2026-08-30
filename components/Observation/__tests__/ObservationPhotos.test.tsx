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
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("../../ui/PhotoViewerModal", () => ({
  __esModule: true,
  default: () => null,
}));

import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";

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
});
