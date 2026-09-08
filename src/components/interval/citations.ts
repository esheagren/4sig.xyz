export type Citation = { url: string; label: string };

// Legacy snapshots pack several citations into semicolon-separated strings.
export function citations(urls: string, names = ""): Citation[] {
  const labels = names.split(";").map((name) => name.trim());
  const seen = new Set<string>();
  return urls.split(";").flatMap((raw, index) => {
    try {
      const url = new URL(raw.trim());
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        seen.has(url.href)
      )
        return [];
      seen.add(url.href);
      return [
        {
          url: url.href,
          label: labels[index] || url.hostname.replace(/^www\./, ""),
        },
      ];
    } catch {
      return [];
    }
  });
}
