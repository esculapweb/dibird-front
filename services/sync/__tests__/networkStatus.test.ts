// networkStatus.ts registers its own top-level NetInfo.addEventListener at
// import time and keeps `connected` as module-level state, so each test needs
// a fresh module instance (resetModules + re-require) — same reasoning as
// hooks/repositories/testDb.ts's loadRepos for repository modules.
type NetInfoMock = {
  __emitNetInfoState: (state: {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  }) => void;
  __resetNetInfoMock: () => void;
};

let networkStatus: typeof import("../networkStatus");
let netinfoMock: NetInfoMock;

beforeEach(() => {
  jest.resetModules();
  netinfoMock = require("@react-native-community/netinfo");
  netinfoMock.__resetNetInfoMock();
  networkStatus = require("../networkStatus");
});

describe("isConnected", () => {
  it("defaults to true before any NetInfo event has been observed", () => {
    expect(networkStatus.isConnected()).toBe(true);
  });

  it("reflects the latest NetInfo state", () => {
    netinfoMock.__emitNetInfoState({ isConnected: false, isInternetReachable: false });
    expect(networkStatus.isConnected()).toBe(false);

    netinfoMock.__emitNetInfoState({ isConnected: true, isInternetReachable: true });
    expect(networkStatus.isConnected()).toBe(true);
  });

  it("treats isInternetReachable === false as disconnected even when isConnected is true", () => {
    netinfoMock.__emitNetInfoState({ isConnected: true, isInternetReachable: false });
    expect(networkStatus.isConnected()).toBe(false);
  });

  it("treats isInternetReachable === null (unknown) as connected, matching isStateConnected's !== false check", () => {
    netinfoMock.__emitNetInfoState({ isConnected: true, isInternetReachable: null });
    expect(networkStatus.isConnected()).toBe(true);
  });
});

describe("subscribeToReconnect", () => {
  it("fires only on the disconnected -> connected edge", () => {
    const callback = jest.fn();
    networkStatus.subscribeToReconnect(callback);

    netinfoMock.__emitNetInfoState({ isConnected: false, isInternetReachable: false });
    expect(callback).not.toHaveBeenCalled();

    netinfoMock.__emitNetInfoState({ isConnected: true, isInternetReachable: true });
    expect(callback).toHaveBeenCalledTimes(1);

    // Staying connected on a further event must not refire it.
    netinfoMock.__emitNetInfoState({ isConnected: true, isInternetReachable: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not fire if the connection never actually dropped", () => {
    const callback = jest.fn();
    networkStatus.subscribeToReconnect(callback);
    netinfoMock.__emitNetInfoState({ isConnected: true, isInternetReachable: true });
    expect(callback).not.toHaveBeenCalled();
  });

  it("fires again on a second disconnect/reconnect cycle", () => {
    const callback = jest.fn();
    networkStatus.subscribeToReconnect(callback);

    netinfoMock.__emitNetInfoState({ isConnected: false, isInternetReachable: false });
    netinfoMock.__emitNetInfoState({ isConnected: true, isInternetReachable: true });
    netinfoMock.__emitNetInfoState({ isConnected: false, isInternetReachable: false });
    netinfoMock.__emitNetInfoState({ isConnected: true, isInternetReachable: true });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("the returned unsubscribe stops further callbacks", () => {
    const callback = jest.fn();
    const unsubscribe = networkStatus.subscribeToReconnect(callback);

    netinfoMock.__emitNetInfoState({ isConnected: false, isInternetReachable: false });
    unsubscribe();
    netinfoMock.__emitNetInfoState({ isConnected: true, isInternetReachable: true });

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("subscribeToConnectionChange", () => {
  it("calls back with the resolved boolean on every state change", () => {
    const callback = jest.fn();
    networkStatus.subscribeToConnectionChange(callback);

    netinfoMock.__emitNetInfoState({ isConnected: false, isInternetReachable: false });
    netinfoMock.__emitNetInfoState({ isConnected: true, isInternetReachable: true });

    expect(callback.mock.calls).toEqual([[false], [true]]);
  });
});
