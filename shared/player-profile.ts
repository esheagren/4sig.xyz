export const playerIcons = [
  {
    id: "orbit",
    label: "Orbit",
    symbol: "◌",
    description: "A point circles a center.",
  },
  {
    id: "wave",
    label: "Wave",
    symbol: "∿",
    description: "A rhythm travels through points.",
  },
  {
    id: "spiral",
    label: "Spiral",
    symbol: "↻",
    description: "A curve grows as it turns.",
  },
  {
    id: "pendulum",
    label: "Pendulum",
    symbol: "⌁",
    description: "A steady swing through balance.",
  },
  {
    id: "bloom",
    label: "Bloom",
    symbol: "✳",
    description: "A curve repeats into petals.",
  },
  {
    id: "braid",
    label: "Braid",
    symbol: "⋈",
    description: "Two waves weave together.",
  },
] as const;
export type PlayerIcon = (typeof playerIcons)[number]["id"];
export type PlayerStyle = PlayerIcon | 'halo' | 'horizon';
export function validPlayerStyle(style: unknown): style is PlayerStyle {
  return validPlayerIcon(style) || style === 'halo' || style === 'horizon';
}
export function styleIcon(style: PlayerStyle): PlayerIcon {
  return style === 'halo' ? 'orbit' : style === 'horizon' ? 'wave' : style;
}
export function normalizeStyle(style: unknown, icon: unknown): PlayerStyle {
  const pattern = normalizeIcon(icon);
  return validPlayerStyle(style) && styleIcon(style) === pattern ? style : pattern;
}
export type Player = { username: string; icon: PlayerIcon; color: string; style?: PlayerStyle };
export const playerColors = [
  { label: "Rust", value: "#ad4128" },
  { label: "Cobalt", value: "#355c9b" },
  { label: "Teal", value: "#276c66" },
  { label: "Plum", value: "#795078" },
  { label: "Saffron", value: "#916b25" },
  { label: "Ink", value: "#352a25" },
] as const;
export const DEFAULT_COLOR = playerColors[0].value;
export function validPlayerIcon(icon: unknown): icon is PlayerIcon {
  return playerIcons.some((p) => p.id === icon);
}
export function normalizeIcon(icon: unknown): PlayerIcon {
  if (validPlayerIcon(icon)) return icon;
  return icon === "spark"
    ? "bloom"
    : icon === "diamond"
      ? "spiral"
      : icon === "crosshair"
        ? "pendulum"
        : "orbit";
}
export function validPlayerColor(color: unknown): color is string {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
}
export function normalizeColor(color: unknown) {
  return validPlayerColor(color) ? color.toLowerCase() : DEFAULT_COLOR;
}
export function colorName(color: string) {
  return (
    playerColors.find((c) => c.value === color.toLowerCase())?.label ??
    color.toUpperCase()
  );
}
export function validUsername(username: string) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}
export function playerSymbol(icon: PlayerIcon) {
  return playerIcons.find((p) => p.id === icon)!.symbol;
}
export function playerLabel(icon: PlayerIcon) {
  return playerIcons.find((p) => p.id === icon)!.label;
}
export type SharedScore = {
  kind?: 'daily' | 'onboarding';
  id: string;
  player: Player;
  edition: string;
  score: number;
  hits: boolean[];
  isRanked: boolean;
};
