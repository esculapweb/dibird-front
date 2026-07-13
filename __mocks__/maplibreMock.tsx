import type { ReactNode } from "react";
import { View, ViewProps } from "react-native";

const Passthrough = (props: ViewProps & { children?: ReactNode }) => (
  <View {...props} />
);

export const MapView = Passthrough;
export const Camera = Passthrough;
export const PointAnnotation = Passthrough;
export const ShapeSource = Passthrough;
export const SymbolLayer = Passthrough;
export const CircleLayer = Passthrough;
export const LineLayer = Passthrough;
export const FillLayer = Passthrough;
export const UserLocation = Passthrough;
export const RasterSource = Passthrough;
export const RasterLayer = Passthrough;

export default {
  MapView,
  Camera,
  PointAnnotation,
  ShapeSource,
  SymbolLayer,
  CircleLayer,
  LineLayer,
  FillLayer,
  UserLocation,
  RasterSource,
  RasterLayer,
};
