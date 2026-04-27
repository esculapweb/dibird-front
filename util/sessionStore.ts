const session: Record<string, unknown> = {};

export const setSession = (key: string, value: unknown): void => {
  session[key] = value;
};

export const getSession = <T = unknown>(key: string): T | null => {
  return (session[key] as T) ?? null;
};