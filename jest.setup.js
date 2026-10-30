import "react-native-gesture-handler/jestSetup";

jest.mock("@react-native-firebase/analytics", () => ({
  getAnalytics: jest.fn(() => ({})),
  setAnalyticsCollectionEnabled: jest.fn(async () => {}),
  logEvent: jest.fn(async () => {}),
  setUserId: jest.fn(async () => {}),
  setUserProperties: jest.fn(async () => {}),
}));

jest.mock("@sentry/react-native", () => ({
  wrap: (component) => component,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  init: jest.fn(),
}));

// A TurboModule with no JS fallback: importing it at all throws under jest.
// MapL uses it, and MapL now sits behind every place dropdown (the picker's map
// view in SelectListModal), so any screen with one would need a local mock.
jest.mock("@react-native-clipboard/clipboard", () => ({ setString: jest.fn() }));

jest.mock("./services/db/client", () => ({
  db: {},
  sqliteDb: {},
  runMigrations: jest.fn(async () => {}),
}));
