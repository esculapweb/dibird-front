// Реальный QueryClient по той же причине, что в OnboardingSpeciesStep.test.tsx.
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
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});
jest.mock("../../ui/DropdownInput", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    __esModule: true,
    default: ({
      value,
      setValue,
    }: {
      value: number | null;
      setValue: (v: number | null) => void;
    }) => (
      <TouchableOpacity testID="country-dropdown" onPress={() => setValue(7)}>
        <Text>{`country:${value ?? "none"}`}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock("../../../hooks/useDropdownQuery", () => ({
  useDropdownQuery: () => ({
    query: { data: [] },
    sort: "name",
    onSortChange: jest.fn(),
  }),
}));
jest.mock("../../../util/fetches", () => ({
  fetchMyCountries: jest.fn(),
  fetchMyDashboardStat: jest.fn(),
}));

import { ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

notifyManager.setScheduler((callback) => callback());
import { fetchMyDashboardStat } from "../../../util/fetches";
import OnboardingCountryStep from "../OnboardingCountryStep";

const mockStat = fetchMyDashboardStat as jest.Mock;
const mockOnChange = jest.fn();

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const renderStep = async (value: number | null) =>
  render(<OnboardingCountryStep value={value} onChange={mockOnChange} />, {
    wrapper,
  });

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mockStat.mockResolvedValue({ seen: 12, total: 812 });
});

afterEach(() => {
  queryClient.clear();
});

it("passes the chosen country up", async () => {
  await renderStep(null);
  await fireEvent.press(screen.getByTestId("country-dropdown"));

  expect(mockOnChange).toHaveBeenCalledWith(7);
});

// Цифра под дропдауном и есть смысл шага: «12 из 812» превращает пустой
// аккаунт в понятную цель.
it("shows how much of the country is already covered", async () => {
  await renderStep(7);

  await waitFor(() =>
    expect(screen.getByTestId("onboarding-country-result")).toBeOnTheScreen(),
  );
  expect(screen.getByText(/12/)).toBeOnTheScreen();
  expect(screen.getByText(/812/)).toBeOnTheScreen();
});

it("asks for nothing until a country is chosen", async () => {
  await renderStep(null);

  expect(mockStat).not.toHaveBeenCalled();
  expect(screen.queryByTestId("onboarding-country-result")).not.toBeOnTheScreen();
});

// «0 из 0» на месте обещанной персонализации хуже, чем её отсутствие: так
// выглядит страна, по которой у бэка ещё нет чек-листа.
it("hides the counter when the country has no species total", async () => {
  mockStat.mockResolvedValue({ seen: 0, total: 0 });

  await renderStep(7);

  await waitFor(() => expect(mockStat).toHaveBeenCalled());
  expect(screen.queryByTestId("onboarding-country-result")).not.toBeOnTheScreen();
});
