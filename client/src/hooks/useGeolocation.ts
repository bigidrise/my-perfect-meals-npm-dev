import { useState, useEffect, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface UseGeolocationReturn extends GeolocationState {
  requestLocation: () => Promise<LocationCoords | null>;
  isNative: boolean;
}

export function useGeolocation(autoRequest = false): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    loading: false,
    error: null,
    permissionDenied: false,
  });

  const isNative = Capacitor.isNativePlatform();

  const requestLocation = useCallback(async (): Promise<LocationCoords | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      if (isNative) {
        const permission = await Geolocation.checkPermissions();
        
        if (permission.location === 'denied') {
          setState(prev => ({
            ...prev,
            loading: false,
            permissionDenied: true,
            error: 'Location permission denied',
          }));
          return null;
        }

        if (permission.location === 'prompt' || permission.location === 'prompt-with-rationale') {
          const requestResult = await Geolocation.requestPermissions();
          if (requestResult.location === 'denied') {
            setState(prev => ({
              ...prev,
              loading: false,
              permissionDenied: true,
              error: 'Location permission denied',
            }));
            return null;
          }
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
        });

        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setState({
          ...coords,
          loading: false,
          error: null,
          permissionDenied: false,
        });

        return coords;
      } else {
        if (!navigator.geolocation) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Geolocation not supported',
          }));
          return null;
        }

        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              };
              setState({
                ...coords,
                loading: false,
                error: null,
                permissionDenied: false,
              });
              resolve(coords);
            },
            (error) => {
              setState(prev => ({
                ...prev,
                loading: false,
                permissionDenied: error.code === error.PERMISSION_DENIED,
                error: error.message,
              }));
              resolve(null);
            },
            {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 60000,
            }
          );
        });
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to get location',
      }));
      return null;
    }
  }, [isNative]);

  useEffect(() => {
    if (autoRequest) {
      requestLocation();
    }
  }, [autoRequest, requestLocation]);

  return {
    ...state,
    requestLocation,
    isNative,
  };
}
