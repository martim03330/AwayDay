import * as Location from 'expo-location';

import type { DevicePosition } from '@/features/presence/types';

export type PositionResult =
  | { status: 'ok'; position: DevicePosition }
  /** `canAskAgain: false`: only the phone's settings can turn it back on. */
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable' };

/** The current location permission, for settings screens: `[status, request]`. */
export const useLocationPermission = Location.useForegroundPermissions;

/** Asks for location while the app is open (never in the background) and reads the current position once. */
export async function getCurrentPosition(): Promise<PositionResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };
    if (!(await Location.hasServicesEnabledAsync())) return { status: 'unavailable' };
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      status: 'ok',
      position: {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy,
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}
