import { clearUserId, getUserId } from "./identity";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const uid = getUserId();
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(uid ? { "X-User-Id": uid } : {}),
        ...init?.headers,
      },
    });
  } catch {
    window.dispatchEvent(new Event("service-offline"));
    throw new Error("服务未连接，请稍后重试");
  }

  window.dispatchEvent(new Event("service-online"));

  if (response.status === 401) {
    clearUserId();
    window.dispatchEvent(new Event("identity-lost"));
  }

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new ApiError(body.detail || `请求失败（${response.status}）`, response.status);
  }

  return response.json() as Promise<T>;
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}
