import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface LocationResult {
  latitude: number;
  longitude: number;
}

export async function getLocation(): Promise<LocationResult> {
  if (Capacitor.isNativePlatform()) {
    const perm = await Geolocation.requestPermissions();
    
    if (perm.location === 'denied') {
      throw new Error('Location permission denied');
    }
    
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
    
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } else {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error(error.message || 'Location access denied'));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
}
