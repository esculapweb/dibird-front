// Manual mock for @react-native-community/netinfo, picked up automatically by
// Jest since this file lives at __mocks__/<package> adjacent to node_modules.
// The upstream package's own jest mock (node_modules/@react-native-community/netinfo/jest/netinfo-mock.js)
// registers addEventListener as a no-op jest.fn() that never actually invokes
// the callback it's given, so it can't exercise networkStatus.ts's
// disconnected->connected edge detection or the sync hooks' reconnect wiring.
// This mock tracks every registered listener and lets a test fire a
// simulated state change through __emitNetInfoState.
type MockNetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

type Listener = (state: MockNetInfoState) => void;

let listeners: Listener[] = [];

const addEventListener = jest.fn((listener: Listener) => {
  listeners.push(listener);
  return jest.fn(() => {
    listeners = listeners.filter((l) => l !== listener);
  });
});

const fetch = jest.fn(async () => ({
  isConnected: true,
  isInternetReachable: true,
}));

export const __emitNetInfoState = (state: MockNetInfoState) => {
  listeners.forEach((listener) => listener(state));
};

export const __resetNetInfoMock = () => {
  listeners = [];
  addEventListener.mockClear();
  fetch.mockClear();
};

export default { addEventListener, fetch };
