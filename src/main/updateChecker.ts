import { app } from "electron";

const REPO = "ilfpns/SpotI";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string | null;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Compares the running version against the repo's latest GitHub release.
 * Returns null (rather than throwing) if the check itself couldn't be
 * completed — a network error, or simply no release having been published
 * yet (a fresh 404 from GitHub, not a bug).
 */
export async function checkForUpdate(): Promise<UpdateCheckResult | null> {
  const currentVersion = app.getVersion();
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { tag_name?: string };
    if (!json.tag_name) return null;

    const latestVersion = json.tag_name.replace(/^v/, "");
    return {
      hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
      currentVersion,
      latestVersion,
    };
  } catch {
    return null;
  }
}
