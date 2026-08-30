// The hook wraps react-query directly, and what is under test is exactly that
// orchestration — the reason sheet, the mutation, and the two ways the feed is
// forgotten afterwards — so a real QueryClient is used (retry off), as in
// useItem.test.tsx.
jest.mock("../../util/fetches", () => ({
  reportContent: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
}));
jest.mock("../repositories/listCacheRepository", () => ({
  clearListCache: jest.fn(),
}));
jest.mock("../useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: (...args: unknown[]) => mockToastShow(...args) },
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: {
    showMenu: (payload: unknown) => mockShowMenu(payload),
    show: (payload: unknown) => mockShowConfirm(payload),
    showContent: (payload: unknown) => mockShowContent(payload),
    hide: () => mockHide(),
  },
}));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));
// Only its props matter here — the element is read, never rendered. The real
// component pulls in the theme context (and AsyncStorage behind it); it has a
// suite of its own.
jest.mock("../../components/Moderation/ReportCommentSheet", () => ({
  __esModule: true,
  default: () => null,
}));

import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

notifyManager.setScheduler((callback) => callback());

import { blockUser, reportContent, unblockUser } from "../../util/fetches";
import { clearListCache } from "../repositories/listCacheRepository";
import {
  communityItemCacheTable,
  communityObservationsCacheTable,
} from "../../services/db/schema";
import { track } from "../../services/analytics";
import { useModeration } from "../useModeration";

const mockShowErrorToast = jest.fn();
const mockToastShow = jest.fn();
const mockShowMenu = jest.fn();
const mockShowConfirm = jest.fn();
const mockShowContent = jest.fn();
const mockHide = jest.fn();

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const renderModeration = () =>
  renderHook(() => ({ ...useModeration() }), { wrapper });

const menuPayload = () =>
  mockShowMenu.mock.calls.at(-1)![0] as {
    title: string;
    items: Array<{ label: string; onPress: () => void }>;
  };

const confirmPayload = () =>
  mockShowConfirm.mock.calls.at(-1)![0] as { onConfirm: () => void };

// The "something else" branch presents a sheet of its own; its element is read
// straight off renderContent rather than rendered — the props are the contract.
const commentSheetProps = (dismiss = jest.fn()) => {
  const payload = mockShowContent.mock.calls.at(-1)![0] as {
    renderContent: (dismiss: () => void) => { props: { onSubmit: (comment: string) => void } };
  };
  return payload.renderContent(dismiss).props;
};

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe("report", () => {
  it("asks what is wrong before sending anything", async () => {
    const { result } = await renderModeration();

    result.current.report({ photo: 7 });

    expect(reportContent).not.toHaveBeenCalled();
    expect(menuPayload().items.map((item) => item.label)).toEqual([
      "report_reason_irrelevant",
      "report_reason_violence",
      "report_reason_sexual",
      "report_reason_something_else",
    ]);
  });

  it("asks about a person what only makes sense about a person", async () => {
    const { result } = await renderModeration();

    // Hate speech is not a complaint about a photograph of a bird, and "not a
    // bird observation" is not a complaint about a person — hence two lists.
    result.current.report({ target_profile: 3 });

    expect(menuPayload().items.map((item) => item.label)).toEqual([
      "report_reason_hate",
      "report_reason_spam",
      "report_reason_something_else",
    ]);
  });

  it("closes the reason sheet on the way out — a menu row does not", async () => {
    (reportContent as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderModeration();

    result.current.report({ photo: 7 });
    menuPayload().items[0].onPress();

    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it("sends the target together with the reason that was picked", async () => {
    (reportContent as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderModeration();

    result.current.report({ photo: 7 });
    menuPayload().items[1].onPress();

    await waitFor(() =>
      expect(reportContent).toHaveBeenCalledWith(
        { photo: 7 },
        "violence",
        undefined,
      ),
    );
  });

  describe("something else", () => {
    it("asks what exactly instead of sending an empty complaint", async () => {
      const { result } = await renderModeration();

      result.current.report({ photo: 7 });
      menuPayload().items[3].onPress();

      // No hide(): the comment sheet replaces the menu in the same bottom
      // sheet, and dismissing first would close it under the new content.
      expect(mockHide).not.toHaveBeenCalled();
      expect(reportContent).not.toHaveBeenCalled();
      expect(mockShowContent).toHaveBeenCalledTimes(1);
    });

    it("sends the written explanation along with the report", async () => {
      (reportContent as jest.Mock).mockResolvedValue(undefined);
      const dismiss = jest.fn();
      const { result } = await renderModeration();

      result.current.report({ photo: 7 });
      menuPayload().items[3].onPress();
      commentSheetProps(dismiss).onSubmit("the bird is not in the photo");

      expect(dismiss).toHaveBeenCalledTimes(1);
      await waitFor(() =>
        expect(reportContent).toHaveBeenCalledWith(
          { photo: 7 },
          "other",
          "the bird is not in the photo",
        ),
      );
    });
  });

  it("names what was reported for analytics", async () => {
    const { result } = await renderModeration();

    result.current.report({ target_profile: 3 });

    expect(track).toHaveBeenCalledWith("report_opened", { target: "profile" });
  });

  it("drops the feed's cached pages, not just its query entries", async () => {
    (reportContent as jest.Mock).mockResolvedValue(undefined);
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = await renderModeration();

    result.current.report({ observation: 1 });
    menuPayload().items[0].onPress();

    // Invalidation alone would not be enough: offline, the next read comes
    // back from SQLite with the reported record still in it.
    await waitFor(() =>
      expect(clearListCache).toHaveBeenCalledWith(communityObservationsCacheTable),
    );
    expect(clearListCache).toHaveBeenCalledWith(communityItemCacheTable);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["Community"] });
  });

  it("confirms to the user and lets the screen move on", async () => {
    (reportContent as jest.Mock).mockResolvedValue(undefined);
    const onDone = jest.fn();
    const { result } = await renderModeration();

    result.current.report({ observation: 1 }, { onDone });
    menuPayload().items[0].onPress();

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", text1: "report_sent_title" }),
    );
  });

  it("leaves the screen where it is when the request fails", async () => {
    (reportContent as jest.Mock).mockRejectedValue({ status: 500 });
    const onDone = jest.fn();
    const { result } = await renderModeration();

    result.current.report({ observation: 1 }, { onDone });
    menuPayload().items[0].onPress();

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
    expect(clearListCache).not.toHaveBeenCalled();
  });
});

describe("block", () => {
  it("confirms first — the feed silently loses a person either way", async () => {
    const { result } = await renderModeration();

    result.current.block(9);

    expect(blockUser).not.toHaveBeenCalled();
    expect(mockShowConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ danger: true, title: "block_user_title" }),
    );
  });

  it("blocks and forgets the feed once confirmed", async () => {
    (blockUser as jest.Mock).mockResolvedValue(undefined);
    const onDone = jest.fn();
    const { result } = await renderModeration();

    result.current.block(9, { onDone });
    confirmPayload().onConfirm();

    await waitFor(() => expect(blockUser).toHaveBeenCalledWith(9));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(clearListCache).toHaveBeenCalledWith(communityObservationsCacheTable);
  });

  it("unblocks without a confirmation — it only gives content back", async () => {
    (unblockUser as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderModeration();

    result.current.unblock(9);

    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith(9));
    expect(mockShowConfirm).not.toHaveBeenCalled();
  });
});
