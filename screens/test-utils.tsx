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
    // Read by hooks/useOpenSpecies to tell "go back to the species page we came
    // from" apart from "push a new one"; an empty stack means it always pushes.
    getState: jest.fn(() => ({ index: -1, routes: [] })),
    getParent: jest.fn(() => createNavigationMock()),
    ...overrides,
  };
}

export function createRouteMock<P>(name: string, params?: P) {
  return { key: `${name}-key`, name, params };
}

export interface TestMenuItem {
  label: string;
  onPress: () => void;
  testID?: string;
  danger?: boolean;
}

/**
 * Presses the "⋯" button of a header and returns the menu rows behind it.
 *
 * Sharing, deleting, reporting and blocking all moved into that menu (see
 * components/ui/overflowMenu), so a screen test that used to press an icon now
 * has to open the menu and pick a row. The mock of `BottomSheet.showMenu` is
 * passed in rather than imported: services/bottomSheet reaches the real
 * UniversalBottomSheet (and @gorhom under it) when it is not mocked, and not
 * every suite that uses these helpers mocks it.
 */
export function openOverflow(
  headerRightEnd: unknown,
  showMenu: jest.Mock,
): TestMenuItem[] {
  const buttons = (headerRightEnd ?? []) as Array<{
    condition?: boolean;
    testID?: string;
    onPress?: () => void;
  }>;
  const overflow = buttons.find((btn) => btn.testID === "overflow-button");

  if (!overflow || overflow.condition === false) {
    throw new Error("the header has no overflow button");
  }

  overflow.onPress?.();
  return showMenu.mock.calls.at(-1)![0].items as TestMenuItem[];
}

/** One row of that menu, by its label (the tests' `t` returns the key). */
export function overflowRow(items: TestMenuItem[], label: string): TestMenuItem {
  const row = items.find((item) => item.label === label);
  if (!row) {
    throw new Error(
      `no "${label}" row in the menu: ${items.map((i) => i.label).join(", ")}`,
    );
  }
  return row;
}
