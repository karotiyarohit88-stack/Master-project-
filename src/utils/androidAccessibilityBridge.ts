export type AndroidAccessibilityAction =
  | 'read_visible_text'
  | 'scroll_forward'
  | 'scroll_backward'
  | 'tap_accessible_element';

export type AndroidAccessibilityPermissionState =
  | 'enabled'
  | 'disabled'
  | 'unavailable'
  | 'unknown';

export interface AndroidAccessibilityActionResult {
  ok: boolean;
  message?: string;
  data?: unknown;
}

export interface AndroidAccessibilityNativeBridge {
  isAccessibilityEnabled: () => Promise<boolean>;
  performAction: (
    action: AndroidAccessibilityAction,
    payload?: Record<string, string | number | boolean>
  ) => Promise<AndroidAccessibilityActionResult>;
}

declare global {
  interface Window {
    AndroidAccessibilityBridge?: AndroidAccessibilityNativeBridge;
  }
}

const SAFE_ACTIONS = new Set<AndroidAccessibilityAction>([
  'read_visible_text',
  'scroll_forward',
  'scroll_backward',
  'tap_accessible_element'
]);

const ACTIONS_REQUIRING_CONFIRMATION = new Set<AndroidAccessibilityAction>([
  'tap_accessible_element'
]);

export function getAndroidAccessibilityBridge(): AndroidAccessibilityNativeBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = window.AndroidAccessibilityBridge;
  if (!bridge ||
      typeof bridge.isAccessibilityEnabled !== 'function' ||
      typeof bridge.performAction !== 'function') return null;
  return bridge;
}

export async function checkAndroidAccessibilityPermission(): Promise<AndroidAccessibilityPermissionState> {
  const bridge = getAndroidAccessibilityBridge();
  if (!bridge) return 'unavailable';
  try {
    return (await bridge.isAccessibilityEnabled()) ? 'enabled' : 'disabled';
  } catch {
    return 'unknown';
  }
}

/**
 * Executes only explicitly allowlisted, non-destructive accessibility actions.
 * Element taps require a fresh, caller-provided human confirmation.
 * This web bridge does not itself grant Android Accessibility permission.
 */
export async function executeSafeAccessibilityAction(
  action: AndroidAccessibilityAction,
  payload: Record<string, string | number | boolean> = {},
  confirmed = false
): Promise<AndroidAccessibilityActionResult> {
  if (!SAFE_ACTIONS.has(action)) {
    return { ok: false, message: 'Action is not allowlisted.' };
  }
  if (ACTIONS_REQUIRING_CONFIRMATION.has(action) && !confirmed) {
    return { ok: false, message: 'Human confirmation is required for this action.' };
  }

  const permission = await checkAndroidAccessibilityPermission();
  if (permission !== 'enabled') {
    return { ok: false, message: 'Android Accessibility permission is not confirmed as enabled.' };
  }

  const bridge = getAndroidAccessibilityBridge();
  if (!bridge) return { ok: false, message: 'Android native accessibility bridge is unavailable.' };

  const safePayload: Record<string, string | number | boolean> = {};
  if (action === 'tap_accessible_element') {
    const elementId = payload.elementId;
    if (typeof elementId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(elementId)) {
      return { ok: false, message: 'A valid accessible element ID is required.' };
    }
    safePayload.elementId = elementId;
  } else if (action === 'read_visible_text') {
    const maxChars = payload.maxChars;
    if (maxChars !== undefined && (typeof maxChars !== 'number' || !Number.isInteger(maxChars) || maxChars < 1 || maxChars > 4000)) {
      return { ok: false, message: 'Text read limit must be between 1 and 4000 characters.' };
    }
    safePayload.maxChars = typeof maxChars === 'number' ? maxChars : 2000;
  }

  try {
    return await bridge.performAction(action, safePayload);
  } catch {
    return { ok: false, message: 'Android accessibility action failed safely.' };
  }
}
