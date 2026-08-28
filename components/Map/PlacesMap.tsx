import { ComponentProps, useCallback, useMemo, useRef, useState } from "react";
import { NativeSyntheticEvent, StyleSheet, View } from "react-native";
import {
  CameraRef,
  GeoJSONSource,
  GeoJSONSourceRef,
  Layer,
  MapRef,
  PixelPoint,
  PressEventWithFeatures,
} from "@maplibre/maplibre-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useTranslation } from "react-i18next";

import MapL from "./MapL";
import PlacesMapLegend from "./PlacesMapLegend";
import { useTheme } from "../../store/theme-context";
import { useLocation } from "../../store/location-context";
import { useLocationUnavailable } from "../../hooks/useLocationUnavailable";
import {
  CLUSTER_COUNT_INPUT,
  CLUSTER_HALO_SPREAD,
  CLUSTER_TOTAL_PROPERTY,
  MapSymbolScale,
  OBSERVATION_SCALE,
  SYMBOL_STROKE_WIDTH,
  placeCountInput,
  radiusForCount,
  radiusStepExpression,
} from "../../constants/mapSymbolScale";
import {
  PlaceFeatureProperties,
  boundsFromFeatures,
  centerOfBounds,
  isSinglePoint,
  placesToFeatureCollection,
} from "../../util/placeMapFeatures";
import { PlaceItem } from "../../types";

// `paint` is typed as a union across every layer kind, so a circle paint built
// from a computed expression has to be pointed at the circle member.
type CirclePaint = Extract<
  ComponentProps<typeof Layer>,
  { type: "circle" }
>["paint"];

const SOURCE_ID = "obsPlaces";
// Roughly a finger's width: closer dots merge rather than overlap.
const CLUSTER_RADIUS = 60;
// Past this the map is close enough that places stand apart on their own.
const CLUSTER_MAX_ZOOM = 14;
// Only used when every place shares one coordinate, so bounds have no size.
const SINGLE_POINT_ZOOM = 12;
// Close enough to recognise the surroundings, wide enough to still show which
// of the user's places they are standing near.
const MY_LOCATION_ZOOM = 13;
// Smaller than the smallest place symbol: the dot answers "where am I", it is
// not one more thing on the scale.
const USER_DOT_RADIUS = 6;
// The screens that host this map put their add button in the bottom-right
// corner: 56 wide at right 20 (see ListScreen's fab). The map's own control
// shares that bottom row to the left of it rather than floating above, so it
// has to clear the button's width and offset plus a gap, less the 12 it
// already sits at.
const FAB_CLEARANCE = 20 + 56 + 10 - 12;

interface PlacesMapProps {
  places: PlaceItem[];
  onSelectPlace: (place: PlaceFeatureProperties) => void;
  /** Keep places whose count is zero — see the util of the same name. */
  includeEmpty?: boolean;
  /** What the symbol sizes count. Defaults to observations. */
  scale?: MapSymbolScale;
}

const PlacesMap = ({
  places,
  onSelectPlace,
  includeEmpty = false,
  scale = OBSERVATION_SCALE,
}: PlacesMapProps) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const insets = useSafeAreaInsets();
  const [legendOpen, setLegendOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const { locationCoords, permissionStatus, requestLocation } = useLocation();
  const handleLocationUnavailable = useLocationUnavailable(
    t("location_unavailable_map_hint"),
  );

  const features = useMemo(
    () =>
      placesToFeatureCollection(places, {
        includeEmpty,
        countProperty: scale.countProperty as never,
      }),
    [places, includeEmpty, scale.countProperty],
  );
  const bounds = useMemo(() => boundsFromFeatures(features), [features]);

  // A zero-size box (one place, or several stacked on one coordinate) makes
  // fitBounds snap to max zoom, which lands the user inside a building. Centre
  // on the point at a sane zoom instead.
  const singlePoint = bounds && isSinglePoint(bounds);

  // Balanced, not High: this only has to put a dot on a map showing places
  // kilometres apart, and the extra seconds a tight GPS fix costs would be
  // spent for nothing (PlaceEditor's locateMe asks for High because pinning a
  // place is precision-sensitive — see usePlaceLocation).
  const handleLocateMe = useCallback(async () => {
    if (permissionStatus === "denied") {
      handleLocationUnavailable();
      return;
    }

    setIsLocating(true);
    try {
      const result = await requestLocation(Location.Accuracy.Balanced);
      if (result) {
        cameraRef.current?.flyTo({
          center: result.coords,
          zoom: MY_LOCATION_ZOOM,
          duration: 600,
        });
      } else if (permissionStatus === "denied") {
        handleLocationUnavailable();
      }
    } finally {
      setIsLocating(false);
    }
  }, [permissionStatus, requestLocation, handleLocationUnavailable]);

  // How much room a symbol takes on screen, in the pixels the press event
  // reports. A cluster's halo counts: it is part of what the cluster covers.
  const outerRadiusOf = useCallback(
    (properties: Record<string, unknown>): number => {
      if (properties.cluster) {
        const count =
          (properties[CLUSTER_TOTAL_PROPERTY] as number | undefined) ??
          (properties.point_count as number | undefined) ??
          0;
        return (
          radiusForCount(scale, count) +
          CLUSTER_HALO_SPREAD +
          SYMBOL_STROKE_WIDTH
        );
      }
      const count = (properties[scale.countProperty] as number | undefined) ?? 0;
      return radiusForCount(scale, count) + SYMBOL_STROKE_WIDTH;
    },
    [scale],
  );

  // MapLibre hit-tests with a finger-sized box, so a tap near two symbols comes
  // back carrying both, in no order worth relying on. Taking features[0] opened
  // whichever the renderer happened to list first: with two places on almost
  // the same coordinate — a small symbol drawn inside a big one — a tap in the
  // outer ring opened the inner place. Project each candidate and pick the
  // symbol the finger actually landed inside, the tightest one first so the
  // inner dot still wins its own area.
  const featureAt = useCallback(
    async (
      features: PressEventWithFeatures["features"],
      point: PixelPoint | undefined,
    ) => {
      if (features.length < 2 || !point) return features[0];

      const scored: {
        feature: (typeof features)[number];
        distance: number;
        radius: number;
      }[] = [];
      for (const feature of features) {
        if (feature.geometry?.type !== "Point") continue;
        // No projection to be had (no native map yet, or it threw): the old
        // first-feature behaviour is still a valid answer, just a coarser one.
        const projected = await mapRef.current
          ?.project(feature.geometry.coordinates as [number, number])
          .catch(() => null);
        if (!projected) return features[0];
        scored.push({
          feature,
          distance: Math.hypot(projected[0] - point[0], projected[1] - point[1]),
          radius: outerRadiusOf(feature.properties ?? {}),
        });
      }
      if (scored.length === 0) return features[0];

      const inside = scored.filter((c) => c.distance <= c.radius);
      const pick = (
        list: typeof scored,
        rank: (c: (typeof scored)[number]) => number,
      ) => list.reduce((best, c) => (rank(c) < rank(best) ? c : best)).feature;

      return inside.length > 0
        ? pick(inside, (c) => c.radius)
        : pick(scored, (c) => c.distance - c.radius);
    },
    [outerRadiusOf],
  );

  const handlePress = useCallback(
    async (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      // Features ride in nativeEvent, the same unwrapping MapL does for the
      // map's own onPress.
      const { features, point } = event.nativeEvent;
      if (!features?.length) return;

      const feature = await featureAt(features, point);
      if (!feature) return;

      const properties = feature.properties ?? {};

      // A cluster is MapLibre's own synthetic feature: it carries point_count
      // and cluster_id, never our place properties. Tapping it zooms to the
      // level where it breaks apart rather than opening anything.
      if (properties.cluster) {
        const zoom = await sourceRef.current?.getClusterExpansionZoom(
          properties.cluster_id,
        );
        if (zoom == null || feature.geometry?.type !== "Point") return;
        cameraRef.current?.flyTo({
          center: feature.geometry.coordinates as [number, number],
          zoom,
          duration: 400,
        });
        return;
      }

      onSelectPlace(properties as PlaceFeatureProperties);
    },
    [onSelectPlace, featureAt],
  );

  return (
    <View style={styles.container}>
      <MapL
        currentCoords={singlePoint ? centerOfBounds(bounds) : null}
        currentZoom={SINGLE_POINT_ZOOM}
        bounds={singlePoint ? undefined : (bounds ?? undefined)}
        cameraRef={cameraRef}
        mapRef={mapRef}
        onUseMyLocation={handleLocateMe}
        isLocating={isLocating}
        myLocationLabel={t("map_my_location")}
        myLocationRightOffset={FAB_CLEARANCE}
        myLocationCompact
        bottomInset={insets.bottom}
        // Reference material, read once — the next touch anywhere on the map
        // is as good a signal as any that it has been read. A tap on a symbol
        // bubbles up here too, which is harmless: that opens the sheet, and
        // the legend has no business staying up behind it.
        onPress={() => setLegendOpen(false)}
      >
        <GeoJSONSource
          ref={sourceRef}
          id={SOURCE_ID}
          data={features}
          cluster
          clusterRadius={CLUSTER_RADIUS}
          clusterMaxZoom={CLUSTER_MAX_ZOOM}
          // Sums the scale's per-place count across the cluster, so a bubble
          // means the same quantity a single dot does — which is what lets
          // both share one size scale.
          //
          // Spelled out as [reduce, map] rather than the style spec's
          // ["+", ["get", ...]] shorthand, which is not portable here: the
          // native bridge hands element 0 straight to the platform, and while
          // Android wraps a bare "+" into Expression.literal("+"), iOS turns it
          // into a constant instead of a reduce. The property then never got
          // computed, ["get", "obs"] came back empty, and every cluster fell
          // through to the first size class — a hundred observations drawn
          // smaller than a place with four.
          clusterProperties={{
            [CLUSTER_TOTAL_PROPERTY]: [
              ["+", ["accumulated"], ["get", CLUSTER_TOTAL_PROPERTY]],
              placeCountInput(scale),
            ],
          }}
          onPress={handlePress}
        >
          {/* No numbers on the symbols: text layers need a `glyphs` URL in the
              style, and the style here is an empty one with just OSM raster
              tiles over it (see MapL). PlacesMapLegend states the size
              classes instead, and the exact count is one tap away. When the
              self-hosted style lands (OFFLINE_MAPS_PLAN.md) a symbol layer
              with `text-field` can join these. */}

          {/* Drawn under the cluster symbol, so it reads as a ring around it.
              This, not colour or size, is what separates a cluster from a
              single place: the two share one scale precisely so that their
              sizes stay comparable by eye. */}
          <Layer
            id="obsClusterHalo"
            type="circle"
            filter={["has", "point_count"]}
            paint={
              {
                "circle-radius": radiusStepExpression(
                  scale,
                  CLUSTER_COUNT_INPUT,
                  CLUSTER_HALO_SPREAD,
                ),
                "circle-color": Colors.clusterHalo,
              } as CirclePaint
            }
          />
          <Layer
            id="obsClusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={
              {
                "circle-radius": radiusStepExpression(scale, CLUSTER_COUNT_INPUT),
                "circle-color": Colors.placeDotFill,
                "circle-stroke-color": Colors.placeDotStroke,
                "circle-stroke-width": SYMBOL_STROKE_WIDTH,
              } as CirclePaint
            }
          />
          <Layer
            id="obsPlaceDots"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={
              {
                "circle-radius": radiusStepExpression(scale, placeCountInput(scale)),
                "circle-color": Colors.placeDotFill,
                "circle-stroke-color": Colors.placeDotStroke,
                "circle-stroke-width": SYMBOL_STROKE_WIDTH,
              } as CirclePaint
            }
          />
        </GeoJSONSource>

        {/* Last, so the dot stays visible over a place symbol it lands on. */}
        {locationCoords && (
          <GeoJSONSource
            id="userLocation"
            data={{
              type: "Feature",
              geometry: { type: "Point", coordinates: locationCoords },
              properties: {},
            }}
          >
            <Layer
              id="userLocationDot"
              type="circle"
              paint={
                {
                  "circle-radius": USER_DOT_RADIUS,
                  "circle-color": Colors.userDotFill,
                  "circle-stroke-color": Colors.userDotStroke,
                  "circle-stroke-width": SYMBOL_STROKE_WIDTH,
                } as CirclePaint
              }
            />
          </GeoJSONSource>
        )}
      </MapL>

      <PlacesMapLegend
        scale={scale}
        expanded={legendOpen}
        onToggle={() => setLegendOpen((open) => !open)}
      />
    </View>
  );
};

export default PlacesMap;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
