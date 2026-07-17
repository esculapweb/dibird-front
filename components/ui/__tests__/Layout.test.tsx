jest.mock("../../../hooks/useContentWidth", () => ({ useContentWidth: () => 600 }));
jest.mock("../BackgroundScene2", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="background-scene" /> };
});
jest.mock("react-native-keyboard-aware-scroll-view", () => {
  const { ScrollView } = require("react-native");
  return {
    KeyboardAwareScrollView: (props: Record<string, unknown>) => (
      <ScrollView testID="keyboard-aware-scroll-view" {...props} />
    ),
  };
});

import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import Layout from "../Layout";

it("renders the background scene by default", async () => {
  await render(
    <Layout>
      <Text>content</Text>
    </Layout>,
  );
  expect(screen.getByTestId("background-scene")).toBeOnTheScreen();
});

it("hides the background scene when hideBackground is set", async () => {
  await render(
    <Layout hideBackground>
      <Text>content</Text>
    </Layout>,
  );
  expect(screen.queryByTestId("background-scene")).not.toBeOnTheScreen();
});

describe("container mode", () => {
  it("uses a plain View by default (no keyboard/scroll)", async () => {
    await render(
      <Layout>
        <Text>content</Text>
      </Layout>,
    );
    expect(screen.getByText("content")).toBeOnTheScreen();
    expect(screen.queryByTestId("keyboard-aware-scroll-view")).not.toBeOnTheScreen();
  });

  it("uses KeyboardAwareScrollView when withKeyboard is set", async () => {
    await render(
      <Layout withKeyboard>
        <Text>content</Text>
      </Layout>,
    );
    expect(screen.getByTestId("keyboard-aware-scroll-view")).toBeOnTheScreen();
    expect(screen.getByText("content")).toBeOnTheScreen();
  });

  it("uses a plain ScrollView when withScroll is set (and withKeyboard isn't)", async () => {
    await render(
      <Layout withScroll>
        <Text>content</Text>
      </Layout>,
    );
    expect(screen.queryByTestId("keyboard-aware-scroll-view")).not.toBeOnTheScreen();
    expect(screen.getByText("content")).toBeOnTheScreen();
  });

  it("prefers withKeyboard over withScroll when both are set", async () => {
    await render(
      <Layout withKeyboard withScroll>
        <Text>content</Text>
      </Layout>,
    );
    expect(screen.getByTestId("keyboard-aware-scroll-view")).toBeOnTheScreen();
  });
});

describe("top/bottom slots", () => {
  it("renders `top` inside the scrollable/container area", async () => {
    await render(
      <Layout top={<Text>top-slot</Text>}>
        <Text>content</Text>
      </Layout>,
    );
    expect(screen.getByText("top-slot")).toBeOnTheScreen();
  });

  it("renders `bottom` only when provided", async () => {
    const { rerender } = await render(
      <Layout>
        <Text>content</Text>
      </Layout>,
    );
    expect(screen.queryByText("bottom-slot")).not.toBeOnTheScreen();

    await rerender(
      <Layout bottom={<Text>bottom-slot</Text>}>
        <Text>content</Text>
      </Layout>,
    );
    expect(screen.getByText("bottom-slot")).toBeOnTheScreen();
  });
});
