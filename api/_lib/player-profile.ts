export const PLAYER_ICONS = [
  "orbit",
  "spark",
  "wave",
  "diamond",
  "crosshair",
] as const;
export function validIcon(
  value: unknown,
): value is (typeof PLAYER_ICONS)[number] {
  return (
    typeof value === "string" && PLAYER_ICONS.some((icon) => icon === value)
  );
}
