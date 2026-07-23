jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../useSavedSort", () => ({
  useSavedSort: () => ({ sort: "ioc_id", loaded: true, onChange: mockOnChange }),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { showContent: jest.fn() },
}));
// Stubbed so the import chain doesn't pull in AsyncStorage; the test only reads
// the props the hook hands it, never renders it.
jest.mock("../../components/Sort/SortSheetContent", () => "SortSheetContent");
jest.mock("../../util/sortOptionsList", () => ({ sortOptionsList: () => [] }));

import { act, renderHook } from "@testing-library/react-native";
import { useTaxonomySort } from "../useTaxonomySort";
import { BottomSheet } from "../../services/bottomSheet";

const mockOnChange = jest.fn();
const mockShowContent = BottomSheet.showContent as jest.Mock;

// Pull the SortSheetContent props out of the sheet the hook opens, without
// mounting it — same trick as reading a screen's headerRight props.
const sheetProps = () => {
  const { renderContent } = mockShowContent.mock.calls.at(-1)![0];
  return renderContent(jest.fn()).props;
};

beforeEach(() => jest.clearAllMocks());

it("shows the pinned sort from a shared link", async () => {
  const { result } = await renderHook(() => useTaxonomySort("name"));

  expect(result.current.sort).toBe("name");
});

it("falls back to the saved sort with no pin", async () => {
  const { result } = await renderHook(() => useTaxonomySort());

  expect(result.current.sort).toBe("ioc_id");
});

it("drops the pin once the user picks a sort, so the control keeps working", async () => {
  const { result } = await renderHook(() => useTaxonomySort("name"));
  expect(result.current.sort).toBe("name");

  await act(async () => result.current.openSortSheet());
  await act(async () => sheetProps().setSort("-ioc_id"));

  // Persisted and the pin released, so the saved value now shows through.
  expect(mockOnChange).toHaveBeenCalledWith("-ioc_id");
  expect(result.current.sort).toBe("ioc_id");
});
