import { useEffect, useCallback } from 'react';
import { useDeviceStore } from '../stores/deviceStore';

const REFRESH_INTERVAL = 5000; // 5 seconds

export function useDevices() {
  const { devices, loading, error, lastUpdated, fetchDevices, clearError } = useDeviceStore();

  const refresh = useCallback(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    // Initial fetch
    fetchDevices();

    // Set up auto-refresh
    const interval = setInterval(fetchDevices, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchDevices]);

  return {
    devices,
    loading,
    error,
    lastUpdated,
    refresh,
    clearError,
    onlineDevices: devices.filter((d) => d.status === 'online'),
    offlineDevices: devices.filter((d) => d.status === 'offline'),
  };
}
