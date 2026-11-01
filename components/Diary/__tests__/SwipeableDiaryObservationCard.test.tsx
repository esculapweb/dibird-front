jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));
jest.mock("../../../hooks/useConfirmDelete", () => ({
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock("../../../hooks/Observation/useOfflineObservation", () => ({
  useDeleteObservation: () => ({ mutate: mockDelete }),
}));
jest.mock("../DiaryObservationCard", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>obs-card</Text> };
});
type MockAction = { testID: string; onPress: () => void };
// SwipeableRow is tested on its own; here only which actions it is given.
jest.mock("../../ui/SwipeableRow", () => {
  const { Pressable, View } = require("react-native");
  return {
    __esModule: true,
    swipeA11yProps: jest.requireActual("../../ui/SwipeableRow").swipeA11yProps,
    default: ({
      rightActions = [],
      children,
    }: {
      rightActions?: MockAction[];
      children: React.ReactNode;
    }) => (
      <View>
        {children}
        {rightActions.map((a) => (
          <Pressable key={a.testID} testID={a.testID} onPress={a.onPress} />
        ))}
      </View>
    ),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import SwipeableDiaryObservationCard from "../SwipeableDiaryObservationCard";
import { DiaryObservationItem } from "../../../types";

const mockNavigation = createNavigationMock();
const mockConfirmDelete = jest.fn();
const mockDelete = jest.fn();

const ITEM = { id: 5 } as DiaryObservationItem;

const renderCard = (owner: boolean) =>
  render(
    <SwipeableDiaryObservationCard
      item={ITEM}
      index={0}
      owner={owner}
      diaryId={11}
      territoryValue={3}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

it("gives someone else's diary no swipe actions", async () => {
  await renderCard(false);
  expect(screen.getByText("obs-card")).toBeOnTheScreen();
  expect(screen.queryByTestId("diary-observation-swipe-edit-5")).toBeNull();
  expect(screen.queryByTestId("diary-observation-swipe-delete-5")).toBeNull();
});

// The row is too trimmed to fill the form from — the editor loads it by id.
it("opens the editor by id, inside this diary", async () => {
  await renderCard(true);
  await fireEvent.press(screen.getByTestId("diary-observation-swipe-edit-5"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
    observationId: 5,
    diaryId: 11,
    territoryValue: 3,
  });
});

it("asks before deleting the observation", async () => {
  await renderCard(true);
  await fireEvent.press(screen.getByTestId("diary-observation-swipe-delete-5"));
  expect(mockDelete).not.toHaveBeenCalled();

  const { message, runDelete } = mockConfirmDelete.mock.calls[0][0];
  expect(message).toBe("delete_observation_message");
  const callbacks = { onSuccess: jest.fn(), onError: jest.fn() };
  runDelete(callbacks);
  expect(mockDelete).toHaveBeenCalledWith(5, callbacks);
});
