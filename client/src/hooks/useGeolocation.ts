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

export interface UseGeolocationReturn extends GeolocationState {
  requestLocation: () => Promise<void>;
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

  const requestLocation = useCallback(async () => {
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
          return;
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
            return;
          }
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
        });

        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          loading: false,
          error: null,
          permissionDenied: false,
        });
      } else {
        if (!navigator.geolocation) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Geolocation not supported',
          }));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            setState({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              loading: false,
              error: null,
              permissionDenied: false,
            });
          },
          (error) => {
            setState(prev => ({
              ...prev,
              loading: false,
              permissionDenied: error.code === error.PERMISSION_DENIED,
              error: error.message,
            }));
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000,
          }
        );
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to get location',
      }));
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
