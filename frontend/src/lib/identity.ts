const USER_ID_KEY = "userId";

export function getUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function setUserId(id: number): void {
  localStorage.setItem(USER_ID_KEY, String(id));
}

export function clearUserId(): void {
  localStorage.removeItem(USER_ID_KEY);
}
