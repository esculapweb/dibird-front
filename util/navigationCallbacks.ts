type CallbackFn = (...args: unknown[]) => void;

const callbacks: Record<string, CallbackFn> = {};

export const setNavigationCallback = (key: string, fn: CallbackFn | null | undefined): void => {
  if (!fn) {
    delete callbacks[key];
    return;
  }
  callbacks[key] = fn;
};

export const setTypedNavigationCallback = <T extends unknown[]>(
  key: string,
  fn: ((...args: T) => void) | null | undefined,
): void => {
  setNavigationCallback(key, fn as CallbackFn | null);
};

export const callNavigationCallback = (key: string, ...args: unknown[]): void => {
  if (callbacks[key]) {
    callbacks[key](...args);
    delete callbacks[key];
  }
};
