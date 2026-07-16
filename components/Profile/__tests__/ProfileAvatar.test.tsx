jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: ({ source, style }: { source: { uri: string }; style: unknown }) => (
      <View testID="profile-avatar-image" accessibilityValue={{ text: source.uri }} accessibilityHint={JSON.stringify(style)} />
    ),
  };
});

import { render, screen } from "@testing-library/react-native";
import ProfileAvatar from "../ProfileAvatar";

it("shows initials from first/last name when there's no avatar", async () => {
  await render(<ProfileAvatar firstName="Jane" lastName="Doe" username="jdoe" size={44} />);
  expect(screen.getByText("JD")).toBeOnTheScreen();
  expect(screen.queryByTestId("profile-avatar-image")).not.toBeOnTheScreen();
});

it("falls back to the first two username characters without a first/last name", async () => {
  await render(<ProfileAvatar username="robin" size={44} />);
  expect(screen.getByText("RO")).toBeOnTheScreen();
});

it("prefixes a bare server path with the media URL", async () => {
  await render(<ProfileAvatar avatar="avatars/1.jpg" username="jdoe" size={44} />);
  expect(screen.getByTestId("profile-avatar-image").props.accessibilityValue.text).toBe(
    "https://test.local/media/avatars/1.jpg",
  );
});

it("uses a local file:// URI as-is (pending offline upload)", async () => {
  await render(<ProfileAvatar avatar="file:///docs/pending-avatar-1.jpg" username="jdoe" size={44} />);
  expect(screen.getByTestId("profile-avatar-image").props.accessibilityValue.text).toBe(
    "file:///docs/pending-avatar-1.jpg",
  );
});

it("uses an already-absolute http(s) URI as-is", async () => {
  await render(<ProfileAvatar avatar="https://cdn.example.com/a.jpg" username="jdoe" size={44} />);
  expect(screen.getByTestId("profile-avatar-image").props.accessibilityValue.text).toBe(
    "https://cdn.example.com/a.jpg",
  );
});

it("defaults borderRadius to half the size", async () => {
  await render(<ProfileAvatar avatar="a.jpg" username="jdoe" size={40} />);
  const style = JSON.parse(screen.getByTestId("profile-avatar-image").props.accessibilityHint);
  expect(style[0].borderRadius).toBe(20);
});

it("honors an explicit borderRadius override", async () => {
  await render(<ProfileAvatar avatar="a.jpg" username="jdoe" size={40} borderRadius={4} />);
  const style = JSON.parse(screen.getByTestId("profile-avatar-image").props.accessibilityHint);
  expect(style[0].borderRadius).toBe(4);
});
