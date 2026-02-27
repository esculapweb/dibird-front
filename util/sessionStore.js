const session = {};

export const setSession = (key, value) => { session[key] = value; };
export const getSession = (key) => session[key] ?? null;