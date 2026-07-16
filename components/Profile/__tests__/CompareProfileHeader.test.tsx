jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

const mockProfileAvatarCapture = jest.fn();
jest.mock("../ProfileAvatar", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockProfileAvatarCapture(props);
    return null;
  },
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import CompareProfileHeader from "../CompareProfileHeader";
import { RatingCompareProfile, RatingCompareProfileCounts } from "../../../types";

const mockNavigation = createNavigationMock();

const PROFILE_1: RatingCompareProfile = {
  avatar: "avatars/1.jpg",
  first_name: "Jane",
  last_name: "Doe",
  username: "jdoe",
  user_id: 1,
};
const PROFILE_2: RatingCompareProfile = {
  avatar: "avatars/2.jpg",
  first_name: "John",
  last_name: "Smith",
  username: "jsmith",
  user_id: 2,
};

const COUNTS: RatingCompareProfileCounts = {
  all: 120,
  common: 45,
  different: 75,
  profile: [80, 90],
  profile_diff: [40, 50],
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders nothing with fewer than 2 profiles", async () => {
  await render(
    <CompareProfileHeader myProfileId={1} profileData={[PROFILE_1]} counts={COUNTS} />,
  );
  expect(screen.queryByText("Jane D.")).not.toBeOnTheScreen();
});

it("renders nothing with no profile data", async () => {
  await render(<CompareProfileHeader myProfileId={1} profileData={[]} counts={COUNTS} />);
  expect(screen.queryByText("common_gent")).not.toBeOnTheScreen();
});

it("shows short names and per-profile counts for both columns", async () => {
  await render(
    <CompareProfileHeader myProfileId={1} profileData={[PROFILE_1, PROFILE_2]} counts={COUNTS} />,
  );
  expect(screen.getByText("Jane D.")).toBeOnTheScreen();
  expect(screen.getByText("John S.")).toBeOnTheScreen();
  expect(screen.getByText("80")).toBeOnTheScreen();
  expect(screen.getByText("90")).toBeOnTheScreen();
});

it("shows the shared common/all counts in the center column", async () => {
  await render(
    <CompareProfileHeader myProfileId={1} profileData={[PROFILE_1, PROFILE_2]} counts={COUNTS} />,
  );
  expect(screen.getByText("45")).toBeOnTheScreen();
  expect(screen.getByText("of 120", { exact: false })).toBeOnTheScreen();
});

it("defaults missing counts to 0", async () => {
  await render(
    <CompareProfileHeader
      myProfileId={1}
      profileData={[PROFILE_1, PROFILE_2]}
      counts={undefined as unknown as RatingCompareProfileCounts}
    />,
  );
  expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(2);
});

it("passes each profile's avatar through to ProfileAvatar", async () => {
  await render(
    <CompareProfileHeader myProfileId={1} profileData={[PROFILE_1, PROFILE_2]} counts={COUNTS} />,
  );
  const avatars = mockProfileAvatarCapture.mock.calls.map((c) => c[0].avatar);
  expect(avatars).toEqual(["avatars/1.jpg", "avatars/2.jpg"]);
});

describe("navigation on tap", () => {
  it("navigates to Stat when tapping the column that is my own profile", async () => {
    await render(
      <CompareProfileHeader myProfileId={1} profileData={[PROFILE_1, PROFILE_2]} counts={COUNTS} />,
    );
    await fireEvent.press(screen.getByText("Jane D."));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Stat");
  });

  it("navigates to UserStat with the profileId when tapping someone else's column", async () => {
    await render(
      <CompareProfileHeader myProfileId={1} profileData={[PROFILE_1, PROFILE_2]} counts={COUNTS} />,
    );
    await fireEvent.press(screen.getByText("John S."));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("UserStat", { profileId: 2 });
  });

  it("treats a null/undefined myProfileId as never matching (always UserStat)", async () => {
    await render(
      <CompareProfileHeader myProfileId={null} profileData={[PROFILE_1, PROFILE_2]} counts={COUNTS} />,
    );
    await fireEvent.press(screen.getByText("Jane D."));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("UserStat", { profileId: 1 });
  });
});
