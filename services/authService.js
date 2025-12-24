let onTokenUpdate = null;

export const setOnTokenUpdate = (callback) => {
  onTokenUpdate = callback;
};

export const notifyTokenUpdate = (token) => {
  if (onTokenUpdate) {
    onTokenUpdate(token);
  }
};