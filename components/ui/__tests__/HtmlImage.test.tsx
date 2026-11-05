// expo-image is native; the stand-in keeps every prop so the test can check
// what the renderer passes (cache policy, size, label) and fire onLoad.
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => <View {...props} />,
  };
});

import { act, render, screen } from "@testing-library/react-native";
import RenderHtml from "react-native-render-html";
import { htmlRenderers } from "../HtmlImage";

const renderHtml = (html: string) =>
  render(
    <RenderHtml
      contentWidth={300}
      source={{ html }}
      renderers={htmlRenderers}
    />,
  );

describe("HtmlImage", () => {
  // Regression (#479): render-html drew <img> with react-native's Image,
  // bypassing the disk cache, so these pictures were gone offline.
  it("draws <img> through expo-image with the disk cache", async () => {
    await renderHtml('<p>x</p><img src="https://dibird.com/a.jpg" alt="Robin">');

    const image = screen.getByTestId("html-image");
    expect(image.props.source).toEqual({ uri: "https://dibird.com/a.jpg" });
    expect(image.props.cachePolicy).toBe("disk");
    expect(image.props.accessibilityLabel).toBe("Robin");
  });

  it("fills the content width and keeps the ratio from the tag's attributes", async () => {
    await renderHtml('<img src="https://dibird.com/a.jpg" width="800" height="400">');

    expect(screen.getByTestId("html-image").props.style).toEqual({
      width: 300,
      aspectRatio: 2,
    });
  });

  it("takes the ratio from the loaded image when the tag has no size", async () => {
    await renderHtml('<img src="https://dibird.com/a.jpg">');
    const image = screen.getByTestId("html-image");
    expect(image.props.style.aspectRatio).toBeCloseTo(4 / 3);

    await act(async () => {
      image.props.onLoad({ source: { width: 500, height: 1000 } });
    });

    expect(screen.getByTestId("html-image").props.style.aspectRatio).toBe(0.5);
  });

  it("renders nothing for an <img> without src instead of crashing", async () => {
    await renderHtml("<p>text</p><img>");

    expect(screen.queryByTestId("html-image")).toBeNull();
    expect(screen.getByText("text")).toBeTruthy();
  });
});
