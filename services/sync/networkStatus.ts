import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

const isStateConnected = (state: NetInfoState) =>
  Boolean(state.isConnected && state.isInternetReachable !== false);

let connected = true;

NetInfo.addEventListener((state) => {
  connected = isStateConnected(state);
});

export const isConnected = () => connected;

export const subscribeToReconnect = (callback: () => void) => {
  let wasConnected = connected;

  return NetInfo.addEventListener((state) => {
    const nowConnected = isStateConnected(state);
    if (nowConnected && !wasConnected) {
      callback();
    }
    wasConnected = nowConnected;
  });
};
