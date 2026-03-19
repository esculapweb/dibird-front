const listeners = new Set();

export const onLoginEvent = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const emitLogin = (profile) => {
  listeners.forEach((cb) => cb(profile));
};

const tokenListeners = new Set();

export const onTokenReady = (cb) => {
  tokenListeners.add(cb);
  return () => tokenListeners.delete(cb);
};

export const emitTokenReady = () => {
  tokenListeners.forEach((cb) => cb());
};