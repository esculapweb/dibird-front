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

import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import Section from "../Section";

it("renders the title and children", async () => {
  await render(
    <Section title="My Section">
      <Text>content</Text>
    </Section>,
  );
  expect(screen.getByText("My Section")).toBeOnTheScreen();
  expect(screen.getByText("content")).toBeOnTheScreen();
});

it("renders no header at all when title is falsy", async () => {
  await render(
    <Section title="" collapsible>
      <Text>content</Text>
    </Section>,
  );
  expect(screen.getByText("content")).toBeOnTheScreen();
  expect(screen.queryByText("chevron-down")).not.toBeOnTheScreen();
});

it("appends a required marker when required", async () => {
  await render(
    <Section title="My Section" required>
      <Text>content</Text>
    </Section>,
  );
  expect(screen.getByText("*", { exact: false })).toBeOnTheScreen();
});

it("renders hint text and hintBlock alongside the title", async () => {
  await render(
    <Section title="My Section" hint="a hint" hintBlock={<Text>hint-block</Text>}>
      <Text>content</Text>
    </Section>,
  );
  expect(screen.getByText("a hint")).toBeOnTheScreen();
  expect(screen.getByText("hint-block")).toBeOnTheScreen();
});

describe("not collapsible (default)", () => {
  it("always shows children and has no chevron; pressing the header does nothing", async () => {
    await render(
      <Section title="My Section">
        <Text>content</Text>
      </Section>,
    );
    expect(screen.queryByText("chevron-down")).not.toBeOnTheScreen();
    expect(screen.queryByText("chevron-up")).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText("My Section"));
    expect(screen.getByText("content")).toBeOnTheScreen();
  });
});

describe("collapsible", () => {
  it("starts expanded, shows a chevron, and collapses/expands children on header press", async () => {
    await render(
      <Section title="My Section" collapsible>
        <Text>content</Text>
      </Section>,
    );
    expect(screen.getByText("chevron-up")).toBeOnTheScreen();
    expect(screen.getByText("content")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("My Section"));
    expect(screen.queryByText("content")).not.toBeOnTheScreen();
    expect(screen.getByText("chevron-down")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("My Section"));
    expect(screen.getByText("content")).toBeOnTheScreen();
  });
});

describe("collapsed (initially collapsed, implicitly collapsible)", () => {
  it("starts hidden with a chevron even though collapsible wasn't explicitly set, and can be expanded", async () => {
    await render(
      <Section title="My Section" collapsed>
        <Text>content</Text>
      </Section>,
    );
    expect(screen.queryByText("content")).not.toBeOnTheScreen();
    expect(screen.getByText("chevron-down")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("My Section"));
    expect(screen.getByText("content")).toBeOnTheScreen();
    expect(screen.getByText("chevron-up")).toBeOnTheScreen();
  });
});
