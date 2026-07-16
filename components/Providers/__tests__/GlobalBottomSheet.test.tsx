const mockUniversalBottomSheetCapture = jest.fn();
jest.mock("../../ui/UniversalBottomSheet", () => {
  const { forwardRef } = require("react");
  return {
    __esModule: true,
    default: forwardRef((props: Record<string, unknown>, ref: unknown) => {
      mockUniversalBottomSheetCapture(props, ref);
      return null;
    }),
  };
});

import { render } from "@testing-library/react-native";
import { bottomSheetRef } from "../../../services/bottomSheet";
import GlobalBottomSheet from "../GlobalBottomSheet";

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders UniversalBottomSheet wired to the shared bottomSheetRef", async () => {
  await render(<GlobalBottomSheet />);
  expect(mockUniversalBottomSheetCapture).toHaveBeenCalledWith({}, bottomSheetRef);
});
