// Format the string without rounding or losing unfinished decimals/exponents.
export function formatEntry(value: string): string {
  return value
    .replaceAll(",", "")
    .replace(/^-?\d+/, (integer) =>
      integer.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
    );
}

export function rawCursor(display: string, cursor: number): number {
  return display.slice(0, cursor).replaceAll(",", "").length;
}

export function displayCursor(value: string, cursor: number): number {
  const display = formatEntry(value);
  let index = 0,
    digits = 0;
  while (index < display.length && digits < cursor) {
    if (display[index] !== ",") digits++;
    index++;
  }
  return index;
}

export function editEntry(
  display: string,
  start: number,
  end: number,
  key: string,
) {
  const raw = display.replaceAll(",", "");
  let from = rawCursor(display, start);
  let to = rawCursor(display, end);
  if (key === "Delete") {
    if (from === to) from = Math.max(0, from - 1);
  } else if (key === "DeleteForward") {
    if (from === to) to = Math.min(raw.length, to + 1);
  }
  const inserted = key === "Delete" || key === "DeleteForward" ? "" : key;
  const value = raw.slice(0, from) + inserted + raw.slice(to);
  return { value, cursor: displayCursor(value, from + inserted.length) };
}
