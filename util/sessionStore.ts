const session: Record<string, unknown> = {};

export const setSession = (key: string, value: unknown): void => {
  session[key] = value;
};

export const getSession = (key: string): unknown => {
  return session[key] ?? null;
};