export const LightColors = {
  backgroundMain: "#F7F6F2",
  imageBg: "#E5E7EB",
  badgeBg: "#f0f0f0",
  overlayBg: "rgba(255,255,255,0.85)",
  overlay: "rgba(0,0,0,0.4)",
  mapOverlay: "rgba(0,0,0,0.25)",
  mainProgressBg: "rgba(0,0,0,0.15)",

  textMain: "#1E2A36",
  textMiddle: "#4c515b",
  textSecondary: "#6B7280",
  textOpposite: "#ffffff",

  main100: "#1d9e75",
  main300: "#e8f5f0",
  // accent: "#f59e0b",
  accent100: "#EAB308",
  accent300: "#FEF3C7",
  accentBlue: "#4F8CFF",
  // accent: "#8B5CF6",
  primary100: "#ffffff",
  primary200: "#cfd8dc",
  primary300: "#eef2ff",
  error100: "#ffe9e7",
  error500: "#f1665a",
  error600: "#d93b2e",
  green: "#1d9e75",
  yellow: "#EAB308",
  star: "#E8D8B0",

  border: "#ced4da",
  dropdownIcon: "#9ca3af",
  radioBorder: "#9ca3af",
  divider: "#e5e7eb",
  tabBorder: "#9ca3af",
  markerBorder: "#ffffff",
  dotBorder: "#ffe9e7",
  statIcon: "#6b7280",
  shadow: "#000",
  switchTrackOff: "#D1D1D6",

  logoText: "#224895",
  logoAccent: "#d93b2e",

  toastSuccess: "rgba(34,197,94,0.9)",
  toastError: "rgba(239,68,68,0.9)",
  toastInfo: "rgba(59,130,246,0.9)",
  toastBorder: "rgba(255,255,255,0.1)",

  compareP1: "#1d9e75",
  compareP2: "#f59e0b",

  accuracyFill: "rgba(0,150,255,0.2)",
  accuracyStroke: "rgba(0,150,255,0.4)",

  squareFill: "rgba(239,68,68,0.2)",
  squareStroke: "rgba(239,68,68,0.5)",

  // Observations map. Not the brand green — OSM tiles are themselves beige and
  // green, and a translucent green dot vanished into them. A saturated
  // red-orange is the one hue the basemap never uses, kept fully opaque and
  // ringed in white so it reads over parks, water and dense city alike. The
  // same values serve both themes: the tiles are the raster OSM ones either
  // way, so there is no dark basemap to adapt to (see MapL's RasterSource).
  //
  // One fill for single places and clusters alike: both mean "this many
  // observations", and they share a size scale so they can be compared by eye.
  // What marks a cluster is the halo, not a different colour or size.
  placeDotFill: "#ee4d2e",
  placeDotStroke: "#ffffff",
  clusterHalo: "rgba(238,77,46,0.28)",
  // "You are here" on the place maps. Deliberately the blue every map app
  // uses for the device's own position rather than the places' colour: it is
  // not one of the plotted places and must not be read as one.
  userDotFill: "#1a73e8",
  userDotStroke: "#ffffff",
};
