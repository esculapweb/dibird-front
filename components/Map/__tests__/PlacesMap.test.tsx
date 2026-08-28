jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
// The shared mock theme carries no map colours, and these tests care that the
// device's own position is not drawn in the places' colour — undefined equals
// undefined, so the assertion would pass on nothing.
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      ...require("../../../screens/mockTheme").mockColors,
      placeDotFill: "#ee4d2e",
      placeDotStroke: "#ffffff",
      clusterHalo: "rgba(238,77,46,0.28)",
      userDotFill: "#1a73e8",
      userDotStroke: "#ffffff",
    },
  }),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockLegendCapture = jest.fn();
jest.mock("../PlacesMapLegend", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: { expanded: boolean }) => {
      mockLegendCapture(props);
      return <Text>{props.expanded ? "legend-open" : "legend-closed"}</Text>;
    },
  };
});
jest.mock("@react-native-clipboard/clipboard", () => ({ setString: jest.fn() }));
const mockRequestLocation = jest.fn();
const mockLocationState = {
  locationCoords: null as [number, number] | null,
  permissionStatus: "granted" as string | null,
};
jest.mock("../../../store/location-context", () => ({
  useLocation: () => ({
    ...mockLocationState,
    requestLocation: mockRequestLocation,
  }),
}));
const mockLocationUnavailable = jest.fn();
jest.mock("../../../hooks/useLocationUnavailable", () => ({
  useLocationUnavailable: () => mockLocationUnavailable,
}));
jest.mock("../../../services/sync/networkStatus", () => ({
  isConnected: () => true,
  subscribeToConnectionChange: () => jest.fn(),
}));

// Local rather than the shared __mocks__/maplibreMock: these tests assert on
// the props the source is configured with and drive the cluster ref, which the
// shared passthrough deliberately keeps inert.
const mockSourceCapture = jest.fn();
const mockLayerCapture = jest.fn();
const mockFlyTo = jest.fn();
const mockProject = jest.fn();
const mockGetClusterExpansionZoom = jest.fn();
jest.mock("@maplibre/maplibre-react-native", () => {
  const { View } = require("react-native");
  const React = require("react");
  return {
    Map: (props: {
      ref?: { current: unknown };
      children?: React.ReactNode;
    }) => {
      if (props.ref) props.ref.current = { project: mockProject };
      return <View testID="map-view">{props.children}</View>;
    },
    Camera: (props: { ref?: { current: unknown } }) => {
      if (props.ref) props.ref.current = { flyTo: mockFlyTo };
      return null;
    },
    Images: () => null,
    RasterSource: () => null,
    Layer: (props: { id: string; paint: Record<string, unknown> }) => {
      mockLayerCapture(props);
      return null;
    },
    GeoJSONSource: (props: {
      ref?: { current: unknown };
      children?: React.ReactNode;
    }) => {
      mockSourceCapture(props);
      if (props.ref) {
        props.ref.current = {
          getClusterExpansionZoom: mockGetClusterExpansionZoom,
        };
      }
      return <View testID="geojson-source">{props.children}</View>;
    },
  };
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";

import PlacesMap from "../PlacesMap";
import {
  CLUSTER_COUNT_INPUT,
  CLUSTER_HALO_SPREAD,
  DIARY_SCALE,
  OBSERVATION_SCALE,
  placeCountInput,
  radiusStepExpression,
} from "../../../constants/mapSymbolScale";
import { PlaceItem } from "../../../types";

const territoryData = { code: "FR", id: 5, name: "France", segment: "" };

const place = (overrides: Partial<PlaceItem> = {}): PlaceItem => ({
  id: 1,
  name: "Zoo",
  favourite: false,
  location: { type: "Point", coordinates: [27.56, 53.9] },
  distance: null,
  preview: null,
  diary_count: 0,
  diary_place_count: 0,
  observation_count: 1,
  species_count: 1,
  territory: 5,
  territory_data: territoryData,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const sourceProps = () =>
  mockSourceCapture.mock.calls.at(-1)![0] as {
    data: { features: { properties: Record<string, unknown> }[] };
    cluster: boolean;
    clusterProperties: Record<string, unknown>;
    onPress: (e: {
      nativeEvent: { features: unknown[]; point?: [number, number] };
    }) => Promise<void>;
  };

const layerById = (id: string) =>
  mockLayerCapture.mock.calls
    .map((call) => call[0])
    .find((props) => props.id === id) as {
    id: string;
    paint: Record<string, unknown>;
  };

const press = (feature: unknown) =>
  act(async () => {
    await sourceProps().onPress({ nativeEvent: { features: [feature] } });
  });

const pressAt = (features: unknown[], point: [number, number]) =>
  act(async () => {
    await sourceProps().onPress({ nativeEvent: { features, point } });
  });

const dotFeature = (properties: Record<string, unknown>) => ({
  geometry: { type: "Point", coordinates: [27.56, 53.9] },
  properties,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetClusterExpansionZoom.mockResolvedValue(9);
  mockProject.mockResolvedValue([100, 100]);
  mockLocationState.locationCoords = null;
  mockLocationState.permissionStatus = "granted";
});

describe("PlacesMap", () => {
  it("feeds the source clustered place points", async () => {
    await render(
      <PlacesMap
        places={[
          place({ id: 1, observation_count: 4 }),
          place({
            id: 2,
            observation_count: 6,
            location: { type: "Point", coordinates: [23.83, 53.68] },
          }),
        ]}
        onSelectPlace={jest.fn()}
      />,
    );

    const props = sourceProps();
    expect(props.cluster).toBe(true);
    expect(props.data.features).toHaveLength(2);
    // Clusters have to report observations, not how many places they merged —
    // the screen is about observations.
    //
    // Regression: the spec's ["+", ["get", ...]] shorthand is not portable
    // through the native bridge — iOS read the bare "+" as a constant rather
    // than a reduce, so `obs` was never computed and every cluster fell to the
    // smallest size class. Only the explicit [reduce, map] pair works on both.
    expect(props.clusterProperties).toEqual({
      total: [
        ["+", ["accumulated"], ["get", "total"]],
        ["get", "observation_count"],
      ],
    });
  });

  it("sizes clusters and single places on one shared scale", async () => {
    // The two used to have separate ramps, which made a cluster of two
    // observations look bigger than a place with a hundred — the sizes could
    // not be compared, which is the only thing size is there for.
    await render(<PlacesMap places={[place()]} onSelectPlace={jest.fn()} />);

    const cluster = layerById("obsClusters").paint["circle-radius"];
    const single = layerById("obsPlaceDots").paint["circle-radius"];

    expect(cluster).toEqual(radiusStepExpression(OBSERVATION_SCALE, CLUSTER_COUNT_INPUT));
    expect(single).toEqual(radiusStepExpression(OBSERVATION_SCALE, placeCountInput(OBSERVATION_SCALE)));
    // Same outputs, only a different count property to read them from.
    expect((cluster as unknown[]).slice(2)).toEqual(
      (single as unknown[]).slice(2),
    );
  });

  it("falls back to the place count if the summed property goes missing", async () => {
    // Belt and braces for the bug above: a cluster sized by how many places it
    // holds is still wrong, but it never draws smaller than an emptier one.
    await render(<PlacesMap places={[place()]} onSelectPlace={jest.fn()} />);

    expect(CLUSTER_COUNT_INPUT).toEqual([
      "coalesce",
      ["get", "total"],
      ["get", "point_count"],
    ]);
    expect(layerById("obsClusters").paint["circle-radius"]).toEqual(
      radiusStepExpression(OBSERVATION_SCALE, CLUSTER_COUNT_INPUT),
    );
  });

  it("marks a cluster with a halo rather than a different size or colour", async () => {
    await render(<PlacesMap places={[place()]} onSelectPlace={jest.fn()} />);

    const halo = layerById("obsClusterHalo").paint;
    const cluster = layerById("obsClusters").paint;
    const single = layerById("obsPlaceDots").paint;

    expect(halo["circle-radius"]).toEqual(
      radiusStepExpression(OBSERVATION_SCALE, CLUSTER_COUNT_INPUT, CLUSTER_HALO_SPREAD),
    );
    expect(cluster["circle-color"]).toBe(single["circle-color"]);
  });

  it("sizes by whatever the given scale counts", async () => {
    // The diaries map hands in its own scale; nothing else about the map
    // changes, which is the point of keeping one component.
    await render(
      <PlacesMap
        places={[place()]}
        onSelectPlace={jest.fn()}
        scale={DIARY_SCALE}
      />,
    );

    expect(layerById("obsPlaceDots").paint["circle-radius"]).toEqual(
      radiusStepExpression(DIARY_SCALE, placeCountInput(DIARY_SCALE)),
    );
    expect(sourceProps().clusterProperties).toEqual({
      total: [
        ["+", ["accumulated"], ["get", "total"]],
        ["get", "diary_place_count"],
      ],
    });
  });

  it("opens the place a dot stands for", async () => {
    const onSelectPlace = jest.fn();
    await render(
      <PlacesMap places={[place({ id: 7 })]} onSelectPlace={onSelectPlace} />,
    );

    await press({
      geometry: { type: "Point", coordinates: [27.56, 53.9] },
      properties: { id: 7, name: "Zoo", observation_count: 4, species_count: 2 },
    });

    expect(onSelectPlace).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, name: "Zoo" }),
    );
  });

  it("zooms into a cluster instead of opening anything", async () => {
    const onSelectPlace = jest.fn();
    await render(
      <PlacesMap places={[place()]} onSelectPlace={onSelectPlace} />,
    );

    await press({
      geometry: { type: "Point", coordinates: [25, 54] },
      properties: { cluster: true, cluster_id: 42, point_count: 3, obs: 17 },
    });

    expect(mockGetClusterExpansionZoom).toHaveBeenCalledWith(42);
    expect(mockFlyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [25, 54], zoom: 9 }),
    );
    expect(onSelectPlace).not.toHaveBeenCalled();
  });

  it("keeps the legend out of the way until it is asked for", async () => {
    await render(<PlacesMap places={[place()]} onSelectPlace={jest.fn()} />);

    expect(mockLegendCapture.mock.calls.at(-1)![0].expanded).toBe(false);
    expect(screen.getByText("legend-closed")).toBeOnTheScreen();
  });

  it("opens and closes the legend on its own toggle", async () => {
    await render(<PlacesMap places={[place()]} onSelectPlace={jest.fn()} />);

    await act(async () => {
      mockLegendCapture.mock.calls.at(-1)![0].onToggle();
    });
    expect(screen.getByText("legend-open")).toBeOnTheScreen();

    await act(async () => {
      mockLegendCapture.mock.calls.at(-1)![0].onToggle();
    });
    expect(screen.getByText("legend-closed")).toBeOnTheScreen();
  });

  it("plots the device's own position once it is known", async () => {
    // Its own source rather than a feature in the places one: it is not a
    // place, and clustering it in with them would make it count towards a
    // bubble's size.
    mockLocationState.locationCoords = [27.5, 53.9];
    await render(<PlacesMap places={[place()]} onSelectPlace={jest.fn()} />);

    const dot = layerById("userLocationDot");
    expect(dot).toBeDefined();
    expect(dot.paint["circle-color"]).not.toBe(
      layerById("obsPlaceDots").paint["circle-color"],
    );
  });

  it("draws no position dot before there is a fix", async () => {
    await render(<PlacesMap places={[place()]} onSelectPlace={jest.fn()} />);

    expect(layerById("userLocationDot")).toBeUndefined();
  });

  it("flies to the device's position on locate me", async () => {
    mockRequestLocation.mockResolvedValue({
      coords: [27.5, 53.9],
      accuracy: 20,
    });
    await render(<PlacesMap places={[place()]} onSelectPlace={jest.fn()} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("map-locate-me"));
    });

    expect(mockFlyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [27.5, 53.9] }),
    );
  });

  it("points a user who already refused at the settings instead of re-asking", async () => {
    mockLocationState.permissionStatus = "denied";
    await render(<PlacesMap places={[place()]} onSelectPlace={jest.fn()} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("map-locate-me"));
    });

    expect(mockRequestLocation).not.toHaveBeenCalled();
    expect(mockLocationUnavailable).toHaveBeenCalled();
  });

  describe("two places on one coordinate", () => {
    // A small symbol drawn inside a big one. MapLibre hit-tests with a
    // finger-sized box and hands back both, in no order worth trusting, so
    // taking the first one opened the inner place from a tap in the outer ring.
    const big = dotFeature({ id: 1, name: "Big", observation_count: 1000 });
    const small = dotFeature({ id: 2, name: "Small", observation_count: 1 });

    it("opens the outer place for a tap outside the inner symbol", async () => {
      const onSelectPlace = jest.fn();
      await render(
        <PlacesMap places={[place()]} onSelectPlace={onSelectPlace} />,
      );

      // 15px from the shared centre: inside the big symbol (radius 22 + 3
      // stroke), well outside the small one (7 + 3).
      await pressAt([small, big], [100, 115]);

      expect(onSelectPlace).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      );
    });

    it("still opens the inner place for a tap on it", async () => {
      const onSelectPlace = jest.fn();
      await render(
        <PlacesMap places={[place()]} onSelectPlace={onSelectPlace} />,
      );

      // 3px out: inside both, so the tighter symbol wins its own area.
      await pressAt([big, small], [100, 103]);

      expect(onSelectPlace).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2 }),
      );
    });

    it("keeps the first feature when the projection is unavailable", async () => {
      mockProject.mockRejectedValue(new Error("no native map"));
      const onSelectPlace = jest.fn();
      await render(
        <PlacesMap places={[place()]} onSelectPlace={onSelectPlace} />,
      );

      await pressAt([small, big], [100, 115]);

      expect(onSelectPlace).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2 }),
      );
    });
  });

  it("ignores a tap that hit no feature", async () => {
    const onSelectPlace = jest.fn();
    await render(
      <PlacesMap places={[place()]} onSelectPlace={onSelectPlace} />,
    );

    await act(async () => {
      await sourceProps().onPress({ nativeEvent: { features: [] } });
    });

    expect(onSelectPlace).not.toHaveBeenCalled();
    expect(mockFlyTo).not.toHaveBeenCalled();
  });
});
