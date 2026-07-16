// useUnreadCount is a thin useQuery wrapper — the real coverage for its
// offline mark-as-read + sync behavior lives in
// services/sync/__tests__/notificationSync.test.ts (markAll/markIds, the
// sentinel id -1 for "mark all read"). This just locks down the query
// config itself (key/fetcher/polling), since a typo here (e.g. drifting
// UNREAD_COUNT_KEY out of sync with notificationSync's invalidateQueries
// calls) would silently stop the badge from ever refreshing.
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn(() => ({})) }));
jest.mock("../../util/fetches", () => ({ fetchUnreadCount: jest.fn() }));

import { useQuery } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react-native";
import { fetchUnreadCount } from "../../util/fetches";
import { useUnreadCount, UNREAD_COUNT_KEY } from "../useUnreadCount";

it("configures useQuery with the unread-count key, fetcher, and a 2-minute poll", async () => {
  await renderHook(() => useUnreadCount());

  expect(useQuery).toHaveBeenCalledWith({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: fetchUnreadCount,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
});
