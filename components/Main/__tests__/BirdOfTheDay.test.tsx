// Uses a real useQuery internally — a real QueryClient is used rather than
// mocking react-query. Unlike custom-hook tests (see
// hooks/__tests__/useItem.test.tsx), this is a plain component render:
// `data`/`isLoading` are read naturally during render (destructured at the
// top), so react-query v5's tracked-queries optimization doesn't freeze
// the tree here the way it can with a bare `renderHook`.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: ({ source }: { source: { uri: string } }) => (
      <View testID="botd-image" accessibilityValue={{ text: source.uri }} />
    ),
  };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="botd-image-placeholder" /> };
});
jest.mock("../BirdOfTheDaySceleton", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="botd-skeleton" /> };
});
jest.mock("../../../store/profile-context", () => ({ useProfile: jest.fn() }));
jest.mock("../../../store/language-context", () => ({ useLanguage: jest.fn() }));
jest.mock("../../../services/bottomSheet", () => ({
  BottomSheet: { showMenu: jest.fn(), hide: jest.fn() },
}));
jest.mock("../../../util/helpers", () => ({
  ...jest.requireActual("../../../util/helpers"),
  speciesDetails: jest.fn(),
}));
jest.mock("../../../util/fetches", () => ({ fetchBirdOfDay: jest.fn() }));

import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";

notifyManager.setScheduler((callback) => callback());
import { createNavigationMock } from "../../../screens/test-utils";
import { useProfile } from "../../../store/profile-context";
import { useLanguage } from "../../../store/language-context";
import { BottomSheet } from "../../../services/bottomSheet";
import { speciesDetails } from "../../../util/helpers";
import { fetchBirdOfDay } from "../../../util/fetches";
import BirdOfTheDay from "../BirdOfTheDay";
import { BirdOfTheDayType, Filters } from "../../../types";

const mockNavigation = createNavigationMock();

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const BIRD = (overrides: Partial<BirdOfTheDayType> = {}): BirdOfTheDayType => ({
  taxon_id: 42,
  territory_id: 5,
  date: "2026-01-01",
  sp_name_lang: "Blue Tit",
  sp_latin: "Cyanistes caeruleus",
  sp_thumb: null,
  sp_segment: "blue-tit",
  featured_count_year: 1,
  reason: {
    avibase_status: null,
    avibase_weight: 0,
    ioc_status: null,
    ioc_weight: 0,
    obs_30d: 0,
    obs_90d: 0,
    days_since_community: 0,
    recency_score: 0,
    user_seen_state: "never_seen",
    final_score: 0,
    hint_key: "hint_seasonal",
  },
  ...overrides,
});

const renderWithClient = async (filters: Filters) =>
  render(<BirdOfTheDay filters={filters} />, { wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  (useProfile as jest.Mock).mockReturnValue({ profile: null });
  (useLanguage as jest.Mock).mockReturnValue({ language: "en" });
  (fetchBirdOfDay as jest.Mock).mockResolvedValue(BIRD());
});

afterEach(() => {
  queryClient.clear();
});

it("does not query without a territory (no filter, no profile territory)", async () => {
  await renderWithClient({});
  expect(fetchBirdOfDay).not.toHaveBeenCalled();
});

it("uses the profile's territory when filters don't specify one", async () => {
  (useProfile as jest.Mock).mockReturnValue({ profile: { territory: 7 } });
  await renderWithClient({});
  expect(fetchBirdOfDay).toHaveBeenCalledWith(7);
});

it("prefers the filter's territory over the profile's", async () => {
  (useProfile as jest.Mock).mockReturnValue({ profile: { territory: 7 } });
  await renderWithClient({ territory: 9 });
  expect(fetchBirdOfDay).toHaveBeenCalledWith(9);
});

it("shows a skeleton while loading, then the bird once resolved", async () => {
  // `render` (async) fully drains the microtask queue via the sync
  // notifyManager scheduler above, so a plain mockResolvedValue would
  // already be settled by the time we could observe the loading skeleton
  // — hold the fetch open until asserted.
  let resolveFetch!: (bird: BirdOfTheDayType) => void;
  (fetchBirdOfDay as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      resolveFetch = resolve;
    }),
  );
  const { findByText } = await renderWithClient({ territory: 5 });
  expect(screen.getByTestId("botd-skeleton")).toBeOnTheScreen();

  resolveFetch(BIRD());
  await findByText("Blue Tit");
  expect(screen.queryByTestId("botd-skeleton")).not.toBeOnTheScreen();
  expect(screen.getByText("Cyanistes caeruleus")).toBeOnTheScreen();
});

describe("thumbnail", () => {
  it("shows the image when sp_thumb is set", async () => {
    (fetchBirdOfDay as jest.Mock).mockResolvedValue(BIRD({ sp_thumb: "species/42/t.jpg" }));
    const { findByTestId } = await renderWithClient({ territory: 5 });
    const image = await findByTestId("botd-image");
    expect(image.props.accessibilityValue.text).toBe("https://test.local/media/species/42/t.jpg");
  });

  it("falls back to a placeholder without a thumb", async () => {
    const { findByText } = await renderWithClient({ territory: 5 });
    await findByText("Blue Tit");
    expect(screen.getByTestId("botd-image-placeholder")).toBeOnTheScreen();
  });
});

describe("seen-state strip", () => {
  it("shows 'find_today' when not yet seen", async () => {
    const { findByText } = await renderWithClient({ territory: 5 });
    await findByText("Blue Tit");
    expect(screen.getByText("find_today")).toBeOnTheScreen();
  });

  it("shows the specific seen-state label and a checkmark for 'seen_recently'", async () => {
    (fetchBirdOfDay as jest.Mock).mockResolvedValue(
      BIRD({ reason: { ...BIRD().reason, user_seen_state: "seen_recently" } }),
    );
    const { findByText } = await renderWithClient({ territory: 5 });
    await findByText("Blue Tit");
    expect(screen.getByText("seen_recently")).toBeOnTheScreen();
    expect(screen.getByText("checkmark-circle")).toBeOnTheScreen();
  });

  it("shows the seen-state label without a checkmark for other already-seen states", async () => {
    (fetchBirdOfDay as jest.Mock).mockResolvedValue(
      BIRD({ reason: { ...BIRD().reason, user_seen_state: "seen_60d_outside" } }),
    );
    const { findByText } = await renderWithClient({ territory: 5 });
    await findByText("Blue Tit");
    expect(screen.getByText("seen_60d_outside")).toBeOnTheScreen();
    expect(screen.queryByText("checkmark-circle")).not.toBeOnTheScreen();
  });
});

describe("hint key", () => {
  it("uses the server-provided hint_key", async () => {
    (fetchBirdOfDay as jest.Mock).mockResolvedValue(
      BIRD({ reason: { ...BIRD().reason, hint_key: "hint_endemic" } }),
    );
    const { findByText } = await renderWithClient({ territory: 5 });
    await findByText("Blue Tit");
    expect(screen.getByText("hint_endemic")).toBeOnTheScreen();
  });

  it("falls back to 'hint_seasonal' without one", async () => {
    (fetchBirdOfDay as jest.Mock).mockResolvedValue(
      BIRD({ reason: { ...BIRD().reason, hint_key: undefined as unknown as string } }),
    );
    const { findByText } = await renderWithClient({ territory: 5 });
    await findByText("Blue Tit");
    expect(screen.getByText("hint_seasonal")).toBeOnTheScreen();
  });
});

describe("tapping the card opens the action menu", () => {
  it("shows add-observation and species-details options", async () => {
    const { findByText } = await renderWithClient({ territory: 5, place: 3 });
    await findByText("Blue Tit");

    await fireEvent.press(screen.getByText("telescope"));
    expect(BottomSheet.showMenu).toHaveBeenCalledWith({
      items: [
        expect.objectContaining({ label: "add_observation" }),
        expect.objectContaining({ label: "species_details" }),
      ],
    });
  });

  it("add-observation navigates to ObservationEditor with the defaults, then hides the sheet", async () => {
    const { findByText } = await renderWithClient({ territory: 5, place: 3 });
    await findByText("Blue Tit");
    await fireEvent.press(screen.getByText("telescope"));

    const items = (BottomSheet.showMenu as jest.Mock).mock.calls[0][0].items;
    items[0].onPress();

    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
      defaultTerritory: 5,
      defaultPlace: 3,
      defaultSpecies: 42,
      returnMode: "back",
    });
    expect(BottomSheet.hide).toHaveBeenCalledTimes(1);
  });

  it("species-details opens the species page, then hides the sheet", async () => {
    const { findByText } = await renderWithClient({ territory: 5 });
    await findByText("Blue Tit");
    await fireEvent.press(screen.getByText("telescope"));

    const items = (BottomSheet.showMenu as jest.Mock).mock.calls[0][0].items;
    items[1].onPress();

    expect(speciesDetails).toHaveBeenCalledWith("blue-tit");
    expect(BottomSheet.hide).toHaveBeenCalledTimes(1);
  });
});
