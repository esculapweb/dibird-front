jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

import { renderHook } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import { useOpenSpecies } from "../useOpenSpecies";

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  getState: jest.fn(() => ({ index: 0, routes: [{ name: "Main" }] })),
};

const open = async () => {
  const { result } = await renderHook(() => useOpenSpecies());
  return result.current;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigation.getState.mockReturnValue({
    index: 0,
    routes: [{ name: "Main" }],
  });
});

it("navigates to the species page, tagging the route with where the tap came from", async () => {
  (await open())("osprey", "observation_list");

  expect(mockNavigation.navigate).toHaveBeenCalledWith("SpeciesDetail", {
    segment: "osprey",
    source: "observation_list",
  });
});

// The segment is localized and comes off the same response as the name on the
// row, so it goes missing on a record created offline and on a copy cached
// under another language. The old helper returned silently, which read as a
// dead tap.
it.each([[undefined], [null], [""]])(
  "says so instead of doing nothing when there is no segment (%p)",
  async (segment) => {
    (await open())(segment as string | null | undefined, "observation");

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "info",
        text1: "species_details_unavailable",
      }),
    );
  },
);

// The editor is opened from a species page, and its "about this bird" button
// leads to the very same bird: pushing would stack a second copy of a screen
// one "back" already reaches.
it("goes back instead of pushing a duplicate of the species underneath", async () => {
  mockNavigation.getState.mockReturnValue({
    index: 1,
    routes: [
      { name: "SpeciesDetail", params: { segment: "osprey" } },
      { name: "ObservationEditor" },
    ] as never,
  });

  (await open())("osprey", "observation_editor");

  expect(mockNavigation.goBack).toHaveBeenCalled();
  expect(mockNavigation.navigate).not.toHaveBeenCalled();
});

it("still pushes when the species underneath is a different bird", async () => {
  mockNavigation.getState.mockReturnValue({
    index: 1,
    routes: [
      { name: "SpeciesDetail", params: { segment: "great-tit" } },
      { name: "ObservationEditor" },
    ] as never,
  });

  (await open())("osprey", "observation_editor");

  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockNavigation.navigate).toHaveBeenCalledWith("SpeciesDetail", {
    segment: "osprey",
    source: "observation_editor",
  });
});
