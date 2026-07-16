// Shared navigation mock factories for screens/__tests__/*.test.tsx — the
// jest.mock("@react-navigation/native", ...) call itself stays inline per
// file (hoisting makes a shared factory function awkward across files with
// different useRoute().params shapes), but the mock *objects* it returns
// are built here so every screen test gets the same navigate/goBack/
// setOptions/getParent shape instead of drifting file to file.
export function createNavigationMock(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    popToTop: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
    getParent: jest.fn(() => createNavigationMock()),
    ...overrides,
  };
}

export function createRouteMock<P>(name: string, params?: P) {
  return { key: `${name}-key`, name, params };
}
