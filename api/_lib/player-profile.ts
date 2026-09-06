import { playerIcons, validPlayerIcon } from "../../shared/player-profile.js";
export const PLAYER_ICONS = [
  ...playerIcons.map((p) => p.id),
  "spark",
  "diamond",
  "crosshair",
];
// Keep old clients/profiles compatible while offering only the six new patterns.
export function validIcon(value: unknown): value is string {
  return (
    validPlayerIcon(value) ||
    value === "spark" ||
    value === "diamond" ||
    value === "crosshair"
  );
}
