const KEY = "tb_jwt";
export const auth = {
  getToken: () => localStorage.getItem(KEY),
  setToken: (t: string) => localStorage.setItem(KEY, t),
  clearToken: () => localStorage.removeItem(KEY),
  isAuthed: () => !!localStorage.getItem(KEY),
};
