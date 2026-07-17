jest.mock("../../queryClient", () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));

// Each test re-requires the module after jest.resetModules() so the
// activeCount/pending module-level state (see syncBatch.ts) starts fresh —
// these are deliberately plain module state, not a class, so a stale count
// from one test must never leak into the next.
const load = () => {
  const { queryClient } = require("../../queryClient");
  const syncBatch = require("../syncBatch");
  return { queryClient, ...syncBatch };
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe("queueInvalidation / flush", () => {
  it("flushes queued keys once activeCount returns to zero", () => {
    const { queryClient, beginSyncPass, endSyncPass, queueInvalidation } = load();

    beginSyncPass();
    queueInvalidation([["Observations"], ["Diaries"]]);
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();

    endSyncPass();

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["Observations"],
      exact: false,
      refetchType: "all",
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["Diaries"],
      exact: false,
      refetchType: "all",
    });
  });

  it("dedupes repeated keys queued across several mutations in one pass", () => {
    const { queryClient, beginSyncPass, endSyncPass, queueInvalidation } = load();

    beginSyncPass();
    queueInvalidation([["Observations"], ["Diaries"]]);
    queueInvalidation([["Observations"], ["Places"]]);
    endSyncPass();

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
  });

  it("does not flush while another pass is still active", () => {
    const { queryClient, beginSyncPass, endSyncPass, queueInvalidation } = load();

    beginSyncPass(); // outer pass (e.g. placeSync)
    beginSyncPass(); // woken pass (e.g. observationSync), still running
    queueInvalidation([["Places"]]);

    endSyncPass(); // outer pass finishes first
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();

    queueInvalidation([["Observations"]]);
    endSyncPass(); // woken pass finishes — only now is it safe to flush

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it("does nothing on flush when nothing was queued", () => {
    const { queryClient, beginSyncPass, endSyncPass } = load();

    beginSyncPass();
    endSyncPass();

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
