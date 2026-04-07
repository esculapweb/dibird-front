const callbacks = {};

export const setNavigationCallback = (key, fn) => {
  if (!fn) {
    delete callbacks[fn];
    return;
  }
  callbacks[key] = fn;
};

export const callNavigationCallback = (key, ...args) => {
  if (callbacks[key]) {
    callbacks[key](...args);
    delete callbacks[key];
  }
};
