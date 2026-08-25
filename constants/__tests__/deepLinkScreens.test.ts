jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("../../util/helpers", () => ({
  langBaseUrl: () => "https://dibird.com",
}));

import { AUTHED_SCREENS } from "../../linking";
import { SHARED_LINK_SCREEN_NAMES } from "../deepLinkScreens";

// `Main` is where the return puts the target on top of, and Privacy/Terms open
// for a guest as they are — neither is something to come back to.
const NOT_A_RETURN_TARGET = new Set(["Main", "Privacy", "Terms"]);

// A screen added to linking.ts but forgotten here would silently lose its
// deep link for guests: the bounce to Welcome still happens, the return no
// longer does, and nothing fails until someone shares that page.
it("lists every screen a shared link can reach", () => {
  const fromLinking = Object.keys(AUTHED_SCREENS).filter(
    (name) => !NOT_A_RETURN_TARGET.has(name),
  );

  expect([...SHARED_LINK_SCREEN_NAMES].sort()).toEqual(fromLinking.sort());
});
