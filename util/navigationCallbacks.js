const callbacks = {};

export const setNavigationCallback = (key, fn) => {
  callbacks[key] = fn;
};

export const callNavigationCallback = (key, ...args) => {
  if (callbacks[key]) {
    callbacks[key](...args);
    delete callbacks[key]; 
  }
};