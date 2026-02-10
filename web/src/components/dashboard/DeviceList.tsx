import { DeviceCard } from './DeviceCard';
import type { Device } from '../../types/device';
import { Loader2, ServerOff } from 'lucide-react';

interface DeviceListProps {
  devices: Device[];
  loading: boolean;
  error: string | null;
  onSSHClick?: (device: Device) => void;
  onRDPClick?: (device: Device) => void;
}

export function DeviceList({ devices, loading, error, onSSHClick, onRDPClick }: DeviceListProps) {
  if (loading && devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-400">Loading devices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load devices</p>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ServerOff className="w-16 h-16 text-gray-600 mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">No devices connected</h3>
        <p className="text-gray-500 text-center max-w-md">
          Start a Pylon agent on your target devices to see them here.
          They will appear automatically once connected.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          onSSHClick={onSSHClick}
          onRDPClick={onRDPClick}
        />
      ))}
    </div>
  );
}
