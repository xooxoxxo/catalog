import { REPO_OWNER, REPO_NAME } from "../config";

export function formatStars(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export async function fetchStarCount(
  opts?: { token?: string; fetchImpl?: typeof fetch },
): Promise<number | null> {
  const f = opts?.fetchImpl ?? fetch;
  try {
    const res = await f(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: unknown };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}
