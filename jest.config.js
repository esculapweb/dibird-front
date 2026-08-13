// Set before workers are forked so it's inherited at process start — setting it in a
// setupFile runs too late, since Node/ICU caches the local timezone on first Date/Intl use.
process.env.TZ = "UTC";

module.exports = {
  preset: "jest-expo",
  // react-native-worklets (reanimated 4's native backend) ships a native
  // (.native.ts) and a plain implementation; without this resolver jest
  // picks the native one and throws "Worklets doesn't seem to be
  // initialized" the moment anything transitively imports reanimated.
  resolver: "react-native-worklets/jest/resolver.js",
  setupFiles: [
    "./jest/env.js",
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ],
  setupFilesAfterEnv: ["./jest.setup.js"],
  transformIgnorePatterns: [
    // Base list matches jest-expo's own default (react-native/@react-native/expo/@expo/
    // navigation/sentry all pass through as prefixes), plus @maplibre and @gorhom which
    // jest-expo does not cover out of the box.
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@maplibre|@gorhom))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
  moduleNameMapper: {
    "^@maplibre/maplibre-react-native$": "<rootDir>/__mocks__/maplibreMock.tsx",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/ios/", "/android/"],
  collectCoverageFrom: [
    // Root-level sources (linking.ts, App.tsx, types.ts, …); `*` matches only
    // the repo root, not subfolders. Jest excludes test files automatically.
    "*.{ts,tsx}",
    "util/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "services/**/*.{ts,tsx}",
    "store/**/*.{ts,tsx}",
    "screens/**/*.{ts,tsx}",
    "!**/*.d.ts",
    // Deliberately-untestable root wiring: build config and app entry points.
    "!drizzle.config.ts",
    "!index.ts",
    "!App.tsx",
  ],
  // A floor, not a target: measured at 91.81 / 84.73 / 88.87 / 92.97 when this
  // was set, and each number is rounded down with a point of slack so that
  // ordinary churn does not turn CI red. It only applies to a run with
  // `--coverage` (CI, `npm run test:coverage`) — a plain `npm test` collects
  // nothing and is not affected.
  //
  // The point is to catch code added without tests: without a floor the number
  // drifts down unnoticed, one uncovered branch at a time. Raise the numbers
  // when the real coverage has moved up for good; lowering them is a decision to
  // be made deliberately, not a way to get a build green.
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 83,
      functions: 87,
      lines: 91,
    },
  },
};
