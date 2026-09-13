export async function adminRequest<T>(
  data: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch("/admin?data=" + data, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Your admin session expired. Sign in again, then retry your edit."
        : (result.error ?? "The request failed."),
    );
  return result;
}
export const num = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
export const time = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
