jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("../../Empty/EmptyState", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ message }: { message: string }) => <Text>{message}</Text>,
  };
});

import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import ItemsList from "../ItemsList";

const renderList = (props: Record<string, unknown> = {}) =>
  render(
    <ItemsList
      data={[{ id: 1 }]}
      renderItem={({ item }: { item: { id: number } }) => (
        <Text>{`row ${item.id}`}</Text>
      )}
      keyExtractor={(item: { id: number }) => String(item.id)}
      {...props}
    />,
  );

const listProps = () => screen.getByTestId("items-list").props;

it("renders its rows", async () => {
  await renderList();

  expect(screen.getByText("row 1")).toBeOnTheScreen();
});

it("takes a tap on a row while the search field still has focus", async () => {
  // Without this the first tap is spent dismissing the keyboard and looks
  // like it did nothing.
  await renderList();

  expect(listProps().keyboardShouldPersistTaps).toBe("handled");
});

it("has no refresh control unless the screen asked for one", async () => {
  await renderList();

  expect(listProps().refreshControl).toBeUndefined();
});

it("pulls to refresh when the screen passes a handler", async () => {
  const onRefresh = jest.fn();

  await renderList({ onRefresh, isRefreshing: true });

  const control = listProps().refreshControl;
  expect(control.props.refreshing).toBe(true);
  await control.props.onRefresh();
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

it("shows the spinner only while the refresh is running", async () => {
  const onRefresh = jest.fn();

  await renderList({ onRefresh });

  expect(listProps().refreshControl.props.refreshing).toBe(false);
});

describe("as a grid", () => {
  const ITEMS = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  // Host tree: Text → cell View → row View (FlatList's own, per row).
  const cellOf = (text: string) => screen.getByText(text).parent!;
  const rowOf = (text: string) => cellOf(text).parent!;

  it("puts as many items in a row as there are columns", async () => {
    await renderList({ data: ITEMS, numColumns: 3 });

    expect(rowOf("row 1")).toBe(rowOf("row 3"));
    expect(rowOf("row 4")).not.toBe(rowOf("row 1"));
  });

  it("gives each item a cell of an equal share of the row", async () => {
    // A fixed width, not flex: 1 — a half-empty last row keeps its tiles the
    // size of every other row's.
    await renderList({ data: ITEMS, numColumns: 4 });

    expect(StyleSheet.flatten(cellOf("row 1").props.style).width).toBe("25%");
  });

  it("leaves the rows unwrapped by default", async () => {
    await renderList();

    expect(
      StyleSheet.flatten(cellOf("row 1").props.style)?.width,
    ).toBeUndefined();
  });
});
