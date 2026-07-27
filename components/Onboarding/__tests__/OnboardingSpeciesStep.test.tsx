// Плитка собирается настоящим useQuery — как в BirdOfTheDay.test.tsx, здесь
// реальный QueryClient, а не мок react-query: `data`/`isError` читаются прямо
// в рендере, и tracked-queries из v5 дерево не подмораживают.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("../../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));
jest.mock("../../../store/filters-context", () => ({
  useFilters: () => ({ date: mockDate }),
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: ({ source }: { source: { uri: string } }) => (
      <View testID="species-thumb" accessibilityValue={{ text: source.uri }} />
    ),
  };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="species-thumb-placeholder" /> };
});
// Дропдаун со шторкой и сортировками — отдельная история; здесь важно лишь
// то, что шаг отдаёт ему выбранный id и получает обратно полный элемент.
jest.mock("../../ui/DropdownInput", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    __esModule: true,
    default: ({
      setValue,
      disabled,
    }: {
      setValue: (v: number | null) => void;
      disabled?: boolean;
    }) => (
      <TouchableOpacity
        testID="species-dropdown"
        disabled={disabled}
        onPress={() => setValue(77)}
      >
        <Text>{`dropdown:${disabled ? "off" : "on"}`}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock("../../ui/SpeciesOptionRow", () => ({ __esModule: true, default: () => null }));
jest.mock("../../../hooks/useDropdownQuery", () => ({
  useDropdownQuery: (args: unknown) => {
    mockUseDropdownQuery(args);
    return mockDropdownQuery;
  },
}));
jest.mock("../../../util/fetches", () => ({
  fetchCommunityObservations: jest.fn(),
  fetchSpecies: jest.fn(),
}));

import { ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

notifyManager.setScheduler((callback) => callback());
import { fetchCommunityObservations, fetchSpecies } from "../../../util/fetches";
import { DateFilter } from "../../../types";
import OnboardingSpeciesStep from "../OnboardingSpeciesStep";

const mockFetchCommunity = fetchCommunityObservations as jest.Mock;
const mockOnPick = jest.fn();
const mockOnLoadError = jest.fn();
const mockUseDropdownQuery = jest.fn();

let queryClient: QueryClient;
let mockDate: DateFilter | undefined;
let mockDropdownQuery: {
  query: { data?: unknown[]; isError: boolean };
  sort: string;
  onSortChange: jest.Mock;
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

/** Наблюдение сообщества в том виде, в каком шаг читает из него вид. */
const obs = (id: number, name: string, thumb: string | null = null) => ({
  id: id * 100,
  species_data: {
    id,
    name: `Latin ${id}`,
    name_lang: name,
    thumb,
    segment: `segment-${id}`,
  },
});

const renderStep = async (territory: number | null = 7) =>
  render(
    <OnboardingSpeciesStep
      territory={territory}
      onPick={mockOnPick}
      isCreating={false}
      onLoadError={mockOnLoadError}
    />,
    { wrapper },
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockDate = { type: "this_year" };
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mockDropdownQuery = {
    query: { data: [{ value: 77, label: "Found by search" }], isError: false },
    sort: "name",
    onSortChange: jest.fn(),
  };
  mockFetchCommunity.mockResolvedValue({
    results: [obs(1, "Great Tit"), obs(2, "Blue Tit"), obs(3, "Robin")],
  });
});

afterEach(() => {
  queryClient.clear();
});

describe("the species tiles", () => {
  it("builds one card per species and hands the whole item back on tap", async () => {
    await renderStep();

    await waitFor(() =>
      expect(screen.getByTestId("onboarding-species-1")).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByTestId("onboarding-species-1"));

    expect(mockOnPick).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 1,
        label: "Great Tit",
        name: "Latin 1",
        segment: "segment-1",
      }),
    );
  });

  // Виды в ленте повторяются — на то список и берётся с запасом.
  it("keeps only the first sighting of each species", async () => {
    mockFetchCommunity.mockResolvedValue({
      results: [
        obs(1, "Great Tit"),
        obs(1, "Great Tit"),
        obs(2, "Blue Tit"),
        obs(3, "Robin"),
      ],
    });

    await renderStep();

    await waitFor(() =>
      expect(screen.getByTestId("onboarding-species-1")).toBeOnTheScreen(),
    );
    expect(screen.getAllByText("Great Tit")).toHaveLength(1);
  });

  it("stops at nine cards", async () => {
    mockFetchCommunity.mockResolvedValue({
      results: Array.from({ length: 20 }, (_, i) => obs(i + 1, `Bird ${i + 1}`)),
    });

    await renderStep();

    await waitFor(() =>
      expect(screen.getByTestId("onboarding-species-1")).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId("onboarding-species-9")).toBeOnTheScreen();
    expect(screen.queryByTestId("onboarding-species-10")).not.toBeOnTheScreen();
  });

  it("falls back to the bird placeholder when the species has no photo", async () => {
    await renderStep();

    await waitFor(() =>
      expect(screen.getAllByTestId("species-thumb-placeholder")).toHaveLength(3),
    );
  });
});

// Так выглядит страна, где сообщества у приложения ещё нет: две карточки на
// месте обещанного «выберите из списка» читаются как поломка, а не подсказка.
describe("a country without a community", () => {
  it("drops the tiles and offers the search instead", async () => {
    mockFetchCommunity.mockResolvedValue({
      results: [obs(1, "Great Tit"), obs(2, "Blue Tit")],
    });

    await renderStep();

    await waitFor(() =>
      expect(screen.getByText("onboarding_species_text_search")).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId("onboarding-species-1")).not.toBeOnTheScreen();
    expect(screen.getByTestId("species-dropdown")).toBeOnTheScreen();
  });

  it("resolves the picked id into the full species item", async () => {
    mockFetchCommunity.mockResolvedValue({ results: [] });

    await renderStep();

    await waitFor(() =>
      expect(screen.getByTestId("species-dropdown")).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByTestId("species-dropdown"));

    expect(mockOnPick).toHaveBeenCalledWith({
      value: 77,
      label: "Found by search",
    });
  });
});

// Форма ключа и аргументы обязаны совпадать с ObservationForm: набор опций от
// даты не зависит (бэк применяет её только к аннотации `seen`), поэтому оба
// экрана должны попадать в одну запись кэша — иначе новичок скачивает 2500
// видов дважды, на этом шаге и при первом открытии редактора.
describe("sharing the species cache with the editor", () => {
  it("keys the query the way the observation editor does", async () => {
    await renderStep();

    const args = mockUseDropdownQuery.mock.calls.at(-1)?.[0];
    expect(args).toEqual(
      expect.objectContaining({
        type: "SpeciesDropdown",
        params: [7, "en", { type: "this_year" }],
        enabled: true,
      }),
    );

    args.queryFn("name");
    expect(fetchSpecies).toHaveBeenCalledWith(7, "name", { type: "this_year" });
  });

  // Тот же гард, что в редакторе: фильтры читаются с диска, и до их готовности
  // запрос ушёл бы с другой датой — то есть мимо общего кэша.
  it("waits for the filters to load", async () => {
    mockDate = undefined;

    await renderStep();

    expect(mockUseDropdownQuery.mock.calls.at(-1)?.[0].enabled).toBe(false);
  });
});

describe("when the lists cannot be loaded", () => {
  // Плитка — не обязательный источник: пока поиск по стране жив, шаг работает,
  // и объявлять тупик рано.
  it("stays usable while the search still works", async () => {
    mockFetchCommunity.mockRejectedValue(new Error("offline"));

    await renderStep();

    await waitFor(() =>
      expect(screen.getByTestId("species-dropdown")).toBeOnTheScreen(),
    );
    expect(mockOnLoadError).toHaveBeenCalledWith(false);
    expect(mockOnLoadError).not.toHaveBeenCalledWith(true);
  });

  // Оба запроса упали — выбирать не из чего. Экран обязан узнать об этом:
  // иначе единственным выходом остаётся «Пропустить», и отказ сети попадает в
  // воронку наравне с отказом человека.
  it("reports the dead end when both requests failed", async () => {
    mockFetchCommunity.mockRejectedValue(new Error("offline"));
    mockDropdownQuery.query = { data: undefined, isError: true };

    await renderStep();

    await waitFor(() => expect(mockOnLoadError).toHaveBeenCalledWith(true));
    expect(screen.getByTestId("onboarding-species-error")).toBeOnTheScreen();
    expect(screen.queryByTestId("species-dropdown")).not.toBeOnTheScreen();
  });
});
