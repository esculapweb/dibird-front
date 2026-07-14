// Set before workers are forked so it's inherited at process start — setting it in a
// setupFile runs too late, since Node/ICU caches the local timezone on first Date/Intl use.
process.env.TZ = "UTC";

module.exports = {
  preset: "jest-expo",
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
    "util/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "services/sync/**/*.{ts,tsx}",
    "store/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
};
