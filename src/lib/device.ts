const DEVICE_ID_KEY = "four_sigma_device_id";

/**
 * Get the device ID from localStorage, creating one if it doesn't exist
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Clear the device ID from localStorage
 * Use when user wants to start fresh or for testing
 */
export function clearDeviceId(): void {
  localStorage.removeItem(DEVICE_ID_KEY);
}

/**
 * Check if a device ID exists
 */
export function hasDeviceId(): boolean {
  return localStorage.getItem(DEVICE_ID_KEY) !== null;
}

/**
 * Check if the device is primarily touch-based (mobile/tablet)
 * Uses multiple heuristics for reliable detection
 */
export function isTouchDevice(): boolean {
  // Check for touch points
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // Check for coarse pointer (finger) vs fine pointer (mouse)
  const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  // Check if hover is not available (touch devices don't truly hover)
  const noHover = window.matchMedia("(hover: none)").matches;

  // A device is considered touch-primary if it has touch AND either coarse pointer or no hover
  // This correctly identifies tablets and phones while excluding laptops with touchscreens
  return hasTouch && (hasCoarsePointer || noHover);
}
