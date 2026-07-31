jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => (
      <View>{children}</View>
    ),
  };
});
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});
// Both data steps are separately tested components with their own requests; the
// screen's job is to walk through them and assemble an observation out of what
// they returned, so here they are reduced to a button and a dump of the props.
jest.mock("../../components/Onboarding/OnboardingCountryStep", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    __esModule: true,
    default: ({
      value,
      onChange,
    }: {
      value: number | null;
      onChange: (v: number | null) => void;
    }) => (
      <TouchableOpacity testID="country-step" onPress={() => onChange(7)}>
        <Text>{`country:${value ?? "none"}`}</Text>
      </TouchableOpacity>
    ),
  };
});
// The location step goes to the permissions and the alert settings itself — it
// has its own test; all that matters to the screen is that the step sits between
// the country and the first observation.
jest.mock("../../components/Onboarding/OnboardingLocationStep", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ testID }: { testID?: string }) => <View testID={testID} />,
  };
});
jest.mock("../../components/Onboarding/OnboardingSpeciesStep", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    __esModule: true,
    default: ({
      territory,
      onPick,
      isCreating,
      onLoadError,
    }: {
      territory: number | null;
      onPick: (s: Record<string, unknown>) => void;
      isCreating: boolean;
      onLoadError?: (failed: boolean) => void;
    }) => {
      const { useEffect } = require("react");
      useEffect(() => onLoadError?.(mockSpeciesLoadFailed), []);
      return (
        <TouchableOpacity
          testID="species-step"
          onPress={() =>
            onPick({ value: 42, label: "Great Tit", name: "Parus major" })
          }
        >
          <Text>{`species-step:${territory}:${isCreating}`}</Text>
        </TouchableOpacity>
      );
    },
  };
});
jest.mock("../../store/profile-context", () => ({
  useProfile: () => ({ profile: mockProfile, updateProfile: mockUpdateProfile }),
}));
jest.mock("../../store/onboarding-context", () => ({
  useOnboarding: () => ({ complete: mockComplete, skip: mockSkip }),
}));
jest.mock("../../hooks/Observation/useOfflineObservation", () => ({
  useCreateObservation: () => mockCreateMutation,
}));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));
jest.mock("../../services/errors", () => ({ logError: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";

import { track } from "../../services/analytics";
import { Profile } from "../../types";
import OnboardingScreen from "../OnboardingScreen";

const mockUpdateProfile = jest.fn();
const mockComplete = jest.fn();
const mockSkip = jest.fn();
const mockMutate = jest.fn();

let mockProfile: Partial<Profile> | null = null;
let mockCreateMutation: { mutate: jest.Mock; isPending: boolean };
let mockSpeciesLoadFailed = false;

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = null;
  mockUpdateProfile.mockResolvedValue(undefined);
  mockCreateMutation = { mutate: mockMutate, isPending: false };
  mockSpeciesLoadFailed = false;
});

const next = async () => fireEvent.press(screen.getByTestId("onboarding-next"));

/** Two value screens → the country. */
const goToCountry = async () => {
  await next();
  await next();
};

/** …the country is picked and confirmed → the location step. */
const goToLocation = async () => {
  await goToCountry();
  await fireEvent.press(screen.getByTestId("country-step"));
  await next();
};

const goToSpecies = async () => {
  await goToLocation();
  await next();
};

describe("walking the flow", () => {
  it("starts on the first value screen", async () => {
    await render(<OnboardingScreen />);

    expect(screen.getByTestId("onboarding-step-1")).toBeOnTheScreen();
    expect(track).toHaveBeenCalledWith("onboarding_step", { step: 1 });
  });

  it("reports every step it shows", async () => {
    await render(<OnboardingScreen />);
    await goToSpecies();

    expect(track).toHaveBeenCalledWith("onboarding_step", { step: 2 });
    expect(track).toHaveBeenCalledWith("onboarding_step", { step: 3 });
    expect(track).toHaveBeenCalledWith("onboarding_step", { step: 4 });
    expect(track).toHaveBeenCalledWith("onboarding_step", { step: 5 });
  });

  // The permission is asked for after the country and before the first record:
  // there is no reason earlier, and later it would drown behind picking a species.
  it("puts the location step between the country and the first observation", async () => {
    await render(<OnboardingScreen />);
    await goToLocation();

    expect(screen.getByTestId("onboarding-step-4")).toBeOnTheScreen();
    expect(screen.queryByTestId("species-step")).not.toBeOnTheScreen();
  });

  // A refused location must not lock the flow: "Next" here is always enabled, the
  // only way out otherwise is "Skip", which cuts the onboarding short entirely.
  it("moves on from the location step without granting anything", async () => {
    await render(<OnboardingScreen />);
    await goToLocation();

    expect(screen.getByTestId("onboarding-next")).not.toBeDisabled();

    await next();

    expect(screen.getByTestId("species-step")).toBeOnTheScreen();
  });

  it("hands the chosen country to the species step", async () => {
    await render(<OnboardingScreen />);
    await goToSpecies();

    expect(screen.getByText("species-step:7:false")).toBeOnTheScreen();
  });
});

describe("the country step", () => {
  // The backend may have set the country itself (by IP at signup) — then the step
  // is confirmed with a single tap, without going into the dropdown.
  it("starts from the country the profile already has", async () => {
    mockProfile = { territory: 3 };
    await render(<OnboardingScreen />);
    await goToCountry();

    expect(screen.getByText("country:3")).toBeOnTheScreen();
  });

  // The button has to be disabled for real, not merely half-transparent: it used
  // to be dimmed by a wrapper with opacity, the press went through and silently
  // hit a guard inside the handler.
  it("refuses to move on without a country", async () => {
    await render(<OnboardingScreen />);
    await goToCountry();

    expect(screen.getByTestId("onboarding-next")).toBeDisabled();

    await next();

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(screen.getByTestId("country-step")).toBeOnTheScreen();
  });

  it("saves the country through the profile", async () => {
    await render(<OnboardingScreen />);
    await goToSpecies();

    expect(mockUpdateProfile).toHaveBeenCalledWith({ territory: 7 });
    expect(track).toHaveBeenCalledWith("onboarding_country_set");
  });

  // The patch goes through the sync queue and need not fail, but if it did — the
  // territory is in the local state anyway, and there is nothing to lock the flow
  // for.
  it("moves on even when saving the profile failed", async () => {
    mockUpdateProfile.mockRejectedValue(new Error("offline"));

    await render(<OnboardingScreen />);
    await goToSpecies();

    expect(screen.getByTestId("species-step")).toBeOnTheScreen();
  });
});

describe("the first observation", () => {
  it("creates it from the tapped species and today's date", async () => {
    await render(<OnboardingScreen />);
    await goToSpecies();
    await fireEvent.press(screen.getByTestId("species-step"));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [vars] = mockMutate.mock.calls[0];
    expect(vars.payload).toEqual(
      expect.objectContaining({
        species: 42,
        territory: 7,
        place: null,
        private: false,
        location_private: true,
      }),
    );
    expect(vars.payload.date_time).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // speciesData is what synthesize needs so that the record is drawn labelled
    // while it is still in the sync queue.
    expect(vars.speciesData).toEqual(
      expect.objectContaining({ value: 42, label: "Great Tit" }),
    );
  });

  it("shows the success screen once the record exists", async () => {
    mockMutate.mockImplementation((_vars, opts) => opts.onSuccess?.());

    await render(<OnboardingScreen />);
    await goToSpecies();
    await fireEvent.press(screen.getByTestId("species-step"));

    expect(screen.getByTestId("onboarding-success")).toBeOnTheScreen();
    expect(screen.getByTestId("onboarding-next")).toBeOnTheScreen();
  });

  // Until a record has been created there is no "Next" on the last step: the only
  // meaningful action is to pick a bird, and a button next to it would read as
  // "this can be skipped".
  it("offers no button until a species has been picked", async () => {
    await render(<OnboardingScreen />);
    await goToSpecies();

    expect(screen.queryByTestId("onboarding-next")).not.toBeOnTheScreen();
  });

  it("finishes the onboarding from the success screen", async () => {
    mockMutate.mockImplementation((_vars, opts) => opts.onSuccess?.());

    await render(<OnboardingScreen />);
    await goToSpecies();
    await fireEvent.press(screen.getByTestId("species-step"));
    await next();

    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  // The observation is already created: an `onboarding_skipped` from this screen
  // would report a drop-off on exactly those who made it to the end.
  it("drops the skip link once the record exists", async () => {
    mockMutate.mockImplementation((_vars, opts) => opts.onSuccess?.());

    await render(<OnboardingScreen />);
    await goToSpecies();
    expect(screen.getByTestId("onboarding-skip")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("species-step"));

    expect(screen.queryByTestId("onboarding-skip")).not.toBeOnTheScreen();
  });

  // Both species lists live online only, and a new account has no cache yet.
  // Without the button the only way out of here would be "Skip", and a network
  // failure would land in the funnel next to a human's refusal.
  it("offers a way out when the species lists failed to load", async () => {
    mockSpeciesLoadFailed = true;

    await render(<OnboardingScreen />);
    await goToSpecies();

    expect(screen.getByTestId("onboarding-next")).toBeOnTheScreen();

    await next();

    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockSkip).not.toHaveBeenCalled();
  });

  // The toast is shown by useMutationWithTranslation; the flow stays on the step
  // so that another bird can be picked.
  it("stays on the step when the record could not be created", async () => {
    mockMutate.mockImplementation((_vars, opts) =>
      opts.onError?.(new Error("boom")),
    );

    await render(<OnboardingScreen />);
    await goToSpecies();
    await fireEvent.press(screen.getByTestId("species-step"));

    expect(screen.getByTestId("species-step")).toBeOnTheScreen();
    expect(screen.queryByTestId("onboarding-success")).not.toBeOnTheScreen();
  });

  it("does not fire a second create while the first is in flight", async () => {
    mockCreateMutation = { mutate: mockMutate, isPending: true };

    await render(<OnboardingScreen />);
    await goToSpecies();
    await fireEvent.press(screen.getByTestId("species-step"));

    expect(mockMutate).not.toHaveBeenCalled();
  });
});

describe("skipping", () => {
  it.each([
    ["the first value screen", 0, 1],
    ["the country step", 2, 3],
  ])("reports the step the user left from — %s", async (_name, steps, expected) => {
    await render(<OnboardingScreen />);
    for (let i = 0; i < steps; i += 1) await next();

    await fireEvent.press(screen.getByTestId("onboarding-skip"));

    expect(mockSkip).toHaveBeenCalledWith(expected);
  });
});
