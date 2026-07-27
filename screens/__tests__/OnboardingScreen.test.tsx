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
// Оба шага с данными — отдельно тестируемые компоненты со своими запросами;
// задача экрана — провести по ним и собрать наблюдение из того, что они
// отдали, поэтому здесь они сведены к кнопке и к дампу пропсов.
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

/** Два экрана ценности → страна. */
const goToCountry = async () => {
  await next();
  await next();
};

const goToSpecies = async () => {
  await goToCountry();
  await fireEvent.press(screen.getByTestId("country-step"));
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
  });

  it("hands the chosen country to the species step", async () => {
    await render(<OnboardingScreen />);
    await goToSpecies();

    expect(screen.getByText("species-step:7:false")).toBeOnTheScreen();
  });
});

describe("the country step", () => {
  // Бэк мог проставить страну сам (по IP при регистрации) — тогда шаг
  // подтверждается одним тапом, без похода в дропдаун.
  it("starts from the country the profile already has", async () => {
    mockProfile = { territory: 3 };
    await render(<OnboardingScreen />);
    await goToCountry();

    expect(screen.getByText("country:3")).toBeOnTheScreen();
  });

  // Кнопка обязана быть выключенной по-настоящему, а не только полупрозрачной:
  // раньше её гасила обёртка с opacity, нажатие проходило и молча упиралось в
  // гард внутри обработчика.
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

  // Патч уходит через очередь синка и падать не обязан, но если упал —
  // территория всё равно есть в локальном состоянии, и запирать на ней поток
  // не за что.
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
    // speciesData нужен synthesize, чтобы запись отрисовалась подписанной,
    // пока она ещё в очереди синка.
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

  // До созданной записи «Далее» на последнем шаге нет: единственное
  // осмысленное действие — выбрать птицу, и кнопка рядом читалась бы как
  // «можно и без этого».
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

  // Наблюдение уже создано: `onboarding_skipped` с этого экрана означал бы в
  // отчёте отвал ровно на тех, кто дошёл до конца.
  it("drops the skip link once the record exists", async () => {
    mockMutate.mockImplementation((_vars, opts) => opts.onSuccess?.());

    await render(<OnboardingScreen />);
    await goToSpecies();
    expect(screen.getByTestId("onboarding-skip")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("species-step"));

    expect(screen.queryByTestId("onboarding-skip")).not.toBeOnTheScreen();
  });

  // Оба списка видов живут только в сети, а у нового аккаунта кэша ещё нет.
  // Без кнопки выйти отсюда можно было бы только «Пропустить», и отказ сети
  // попадал бы в воронку наравне с отказом человека.
  it("offers a way out when the species lists failed to load", async () => {
    mockSpeciesLoadFailed = true;

    await render(<OnboardingScreen />);
    await goToSpecies();

    expect(screen.getByTestId("onboarding-next")).toBeOnTheScreen();

    await next();

    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockSkip).not.toHaveBeenCalled();
  });

  // Тост показывает useMutationWithTranslation; поток остаётся на шаге, чтобы
  // можно было выбрать другую птицу.
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
