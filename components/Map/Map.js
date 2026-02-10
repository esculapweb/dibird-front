import {
  MapView,
  Camera,
  RasterSource,
  RasterLayer,
  ShapeSource,
  SymbolLayer,
  CircleLayer,
} from "@maplibre/maplibre-react-native";

import { Config } from "../../constants/config";

const Map = ({
  currentCoords,
  currentZoom = 12,
  onPress=()=>{},
  accuracy,
}) => {
  const [lng, lat] = currentCoords ?? [];

  const metersToPixels = (meters, latitude, zoom) => {
    const earthCircumference = 40075016.686;
    const latRad = (latitude * Math.PI) / 180;
    const mapWidth = 512 * Math.pow(2, zoom);
    return (meters / (earthCircumference * Math.cos(latRad))) * mapWidth;
  };

  return (
    <MapView
      style={{ flex: 1 }}
      onPress={onPress}
      minZoomLevel={1}
      maxZoomLevel={19}
    >
      <Camera
        centerCoordinate={[lng, lat]}
        zoomLevel={Math.min(currentZoom, 19)}
        animationDuration={0}
      />
      <RasterSource
        id="osmTiles"
        tileUrlTemplates={[Config.mapTileUrl]}
        tileSize={256}
      >
        <RasterLayer id="osmLayer" sourceID="osmTiles" />
      </RasterSource>

      <ShapeSource
        id="selectedPoint"
        shape={{
          type: "Feature",
          geometry: { type: "Point", coordinates: [lng, lat] },
        }}
      >
        {accuracy && accuracy > 0 && (
          <CircleLayer
            id="accuracyCircleLayer"
            sourceID="selectedPoint"
            style={{
              circleRadius: metersToPixels(accuracy, lat, currentZoom),
              circleColor: "rgba(0,150,255,0.2)",
              circleStrokeColor: "rgba(0,150,255,0.3)",
              circleStrokeWidth: 1,
            }}
          />
        )}
        <SymbolLayer
          id="selectedPointIcon"
          sourceID="selectedPoint"
          style={{
            iconImage: require("../../assets/marker1.png"),
            iconSize: 1,
            iconAnchor: "bottom",
            iconAllowOverlap: true,
          }}
        />
      </ShapeSource>
    </MapView>
  );
};

export default Map;
