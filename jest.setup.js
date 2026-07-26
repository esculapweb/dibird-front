import "react-native-gesture-handler/jestSetup";

jest.mock("@react-native-firebase/analytics", () => ({
  getAnalytics: jest.fn(() => ({})),
  setAnalyticsCollectionEnabled: jest.fn(async () => {}),
  logEvent: jest.fn(async () => {}),
}));

jest.mock("@sentry/react-native", () => ({
  wrap: (component) => component,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  init: jest.fn(),
}));

jest.mock("./services/db/client", () => ({
  db: {},
  sqliteDb: {},
  runMigrations: jest.fn(async () => {}),
}));
