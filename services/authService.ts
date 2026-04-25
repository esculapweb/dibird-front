let onTokenUpdate: ((token: string) => void) | null = null;


export const setOnTokenUpdate = (callback: (token: string) => void) => {
  onTokenUpdate = callback;
};

export const notifyTokenUpdate = (token: string) => {
  if (onTokenUpdate) {
    onTokenUpdate(token);
  }
};