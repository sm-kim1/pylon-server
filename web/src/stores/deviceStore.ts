import { create } from 'zustand';
import type { Device } from '../types/device';
import { fetchDevices } from '../services/api';

interface DeviceState {
  devices: Device[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  fetchDevices: () => Promise<void>;
  clearError: () => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  loading: false,
  error: null,
  lastUpdated: null,

  fetchDevices: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetchDevices();
      set({
        devices: response.devices,
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch devices',
        loading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
