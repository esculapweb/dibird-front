jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count == null ? key : `${key}:${opts.count}`,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => (
      <Text testID={`icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock("../../../util/helpers", () => ({
  normalizeDistance: (m: number) => `~${m} m`,
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import NearbyPlaceSuggestion from "../NearbyPlaceSuggestion";
import { NearbyPlace } from "../../../hooks/Place/useNearbyPlaces";
import { PlaceDropdownItem } from "../../../types";

const mockOnSelect = jest.fn();
const mockOnDismiss = jest.fn();

const candidate = (value: number, distanceM: number): NearbyPlace => ({
  place: { value, label: `Place ${value}` } as PlaceDropdownItem,
  distanceM,
});

const baseProps = (overrides: Record<string, unknown> = {}) => ({
  nearest: candidate(1, 40),
  others: [] as NearbyPlace[],
  isStrong: true,
  variant: "picker" as const,
  onSelect: mockOnSelect,
  onDismiss: mockOnDismiss,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders nothing when there is no place to suggest", async () => {
  await render(<NearbyPlaceSuggestion {...baseProps({ nearest: null })} />);
  expect(screen.queryByTestId("nearby-place-suggestion")).toBeNull();
});

it("names the nearest place and how far away it is", async () => {
  await render(<NearbyPlaceSuggestion {...baseProps()} />);

  expect(screen.getByText("Place 1")).toBeTruthy();
  expect(screen.getByText("~40 m")).toBeTruthy();
});

describe("wording", () => {
  it("asks whether the user is standing there, in a form", async () => {
    await render(<NearbyPlaceSuggestion {...baseProps()} />);

    expect(screen.getByText("nearby_place_maybe_here")).toBeTruthy();
    expect(screen.getByText("nearby_place_use_it")).toBeTruthy();
    expect(screen.getByText("nearby_place_not_it")).toBeTruthy();
  });

  it("warns about the duplicate instead, in the place editor", async () => {
    await render(<NearbyPlaceSuggestion {...baseProps({ variant: "editor" })} />);

    expect(screen.getByText("nearby_place_exists_title")).toBeTruthy();
    expect(screen.getByText("nearby_place_select_existing")).toBeTruthy();
    expect(screen.getByText("nearby_place_create_anyway")).toBeTruthy();
  });

  it("drops to a remark, with no buttons, when the match is only approximate", async () => {
    await render(<NearbyPlaceSuggestion {...baseProps({ isStrong: false })} />);

    expect(screen.getByText("nearby_place_around_title")).toBeTruthy();
    expect(screen.queryByTestId("nearby-place-use")).toBeNull();
  });
});

describe("accepting the suggestion", () => {
  it("hands back the nearest place from the button", async () => {
    await render(<NearbyPlaceSuggestion {...baseProps()} />);
    await fireEvent.press(screen.getByTestId("nearby-place-use"));

    expect(mockOnSelect).toHaveBeenCalledWith(baseProps().nearest.place);
  });

  it("makes the row itself the control when there are no buttons", async () => {
    await render(<NearbyPlaceSuggestion {...baseProps({ isStrong: false })} />);
    await fireEvent.press(screen.getByTestId("nearby-place-option-1"));

    expect(mockOnSelect).toHaveBeenCalledWith(baseProps().nearest.place);
  });

  it("does not double up as a control while the buttons are there", async () => {
    await render(<NearbyPlaceSuggestion {...baseProps()} />);
    await fireEvent.press(screen.getByTestId("nearby-place-option-1"));

    expect(mockOnSelect).not.toHaveBeenCalled();
  });
});

describe("saying no", () => {
  it("dismisses from the reject button", async () => {
    await render(<NearbyPlaceSuggestion {...baseProps()} />);
    await fireEvent.press(screen.getByTestId("nearby-place-reject"));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("dismisses from the close icon, the quiet tone's only way out", async () => {
    await render(<NearbyPlaceSuggestion {...baseProps({ isStrong: false })} />);
    await fireEvent.press(screen.getByTestId("nearby-place-dismiss"));
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});

describe("the runners-up", () => {
  it("keeps them behind one tap, counted", async () => {
    await render(
      <NearbyPlaceSuggestion
        {...baseProps({ others: [candidate(2, 90), candidate(3, 300)] })}
      />,
    );

    expect(screen.getByText("nearby_place_more:2")).toBeTruthy();
    expect(screen.queryByTestId("nearby-place-option-2")).toBeNull();

    await fireEvent.press(screen.getByTestId("nearby-place-expand"));
    expect(screen.getByTestId("nearby-place-option-2")).toBeTruthy();
    expect(screen.getByTestId("nearby-place-option-3")).toBeTruthy();
  });

  it("offers no expander when the nearest is the only one", async () => {
    await render(<NearbyPlaceSuggestion {...baseProps()} />);
    expect(screen.queryByTestId("nearby-place-expand")).toBeNull();
  });

  it("selects a runner-up straight from its row", async () => {
    const others = [candidate(2, 90)];
    await render(<NearbyPlaceSuggestion {...baseProps({ others })} />);
    await fireEvent.press(screen.getByTestId("nearby-place-expand"));
    await fireEvent.press(screen.getByTestId("nearby-place-option-2"));

    expect(mockOnSelect).toHaveBeenCalledWith(others[0].place);
  });
});
