import type { ReactNode, Ref } from "react";
import { View, ViewProps } from "react-native";

// Mirrors the v11 API surface the app actually imports (see components/Map/
// MapL.tsx and components/Observation/ObservationsMap.tsx). It used to export
// the v10 names — MapView/ShapeSource/SymbolLayer/CircleLayer/PointAnnotation —
// none of which exist in the installed 11.x, so it mocked nothing real and
// every map test had to re-mock the library inline.
//
// Components that hold children render them; leaf ones render nothing, so a
// test can assert on what a map draws without a native module.

const Passthrough = (props: ViewProps & { children?: ReactNode }) => (
  <View {...props} />
);

const Leaf = () => null;

export const Map = Passthrough;
export const Camera = Leaf;
export const Images = Leaf;
export const Layer = Leaf;
export const RasterSource = Passthrough;
export const VectorSource = Passthrough;
export const ImageSource = Passthrough;
export const RasterDemSource = Passthrough;
export const UserLocation = Leaf;
export const NativeUserLocation = Leaf;

// Ref-bearing: ObservationsMap drives clustering through
// GeoJSONSourceRef.getClusterExpansionZoom. The mock resolves the ref with
// inert implementations so a component under test can call them without a
// native module; a test that asserts on the values re-mocks this one locally.
export const GeoJSONSource = ({
  ref,
  children,
  ...props
}: ViewProps & {
  children?: ReactNode;
  ref?: Ref<unknown>;
  [key: string]: unknown;
}) => {
  if (ref && typeof ref === "object") {
    (ref as { current: unknown }).current = {
      getData: async () => null,
      getClusterExpansionZoom: async () => 0,
      getClusterLeaves: async () => [],
      getClusterChildren: async () => [],
      getAnimatableRef: () => null,
    };
  }
  return <View {...(props as ViewProps)}>{children}</View>;
};

export default {
  Map,
  Camera,
  Images,
  Layer,
  RasterSource,
  VectorSource,
  ImageSource,
  RasterDemSource,
  UserLocation,
  NativeUserLocation,
  GeoJSONSource,
};
