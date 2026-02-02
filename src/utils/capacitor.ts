/**
 * Check if the app is running inside a Capacitor native shell (iOS/Android).
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as Record<string, unknown>).Capacitor
}
