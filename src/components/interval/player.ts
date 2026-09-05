export const playerIcons = [
  { id: "orbit", label: "Orbit", symbol: "◉" },
  { id: "spark", label: "Spark", symbol: "✦" },
  { id: "wave", label: "Wave", symbol: "∿" },
  { id: "diamond", label: "Diamond", symbol: "◇" },
  { id: "crosshair", label: "Crosshair", symbol: "⊕" },
] as const;
export type PlayerIcon = (typeof playerIcons)[number]["id"];
export type Player = { username: string; icon: PlayerIcon };
export function validUsername(username: string) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}
export function validPlayerIcon(icon: unknown): icon is PlayerIcon {
  return playerIcons.some((item) => item.id === icon);
}
export function playerSymbol(icon: PlayerIcon) {
  return playerIcons.find((item) => item.id === icon)!.symbol;
}
