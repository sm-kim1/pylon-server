import { Terminal, MonitorPlay, Clock } from 'lucide-react';
import type { Device } from '../../types/device';

interface DeviceCardProps {
  device: Device;
  onSSHClick?: (device: Device) => void;
  onRDPClick?: (device: Device) => void;
}

export function DeviceCard({ device, onSSHClick, onRDPClick }: DeviceCardProps) {
  const isOnline = device.status === 'online';

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-5 hover:border-gray-700 transition-all duration-200 hover:shadow-lg hover:shadow-black/20">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-500'
              }`}
            />
            <h3 className="text-lg font-semibold text-white">{device.name}</h3>
          </div>
          <p className="text-sm text-gray-400 mt-1 font-mono">{device.ipAddress}</p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isOnline
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
          }`}
        >
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <Clock className="w-3.5 h-3.5" />
        <span>Last seen: {formatLastSeen(device.lastSeen)}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSSHClick?.(device)}
          disabled={!isOnline || !device.capabilities.ssh}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            isOnline && device.capabilities.ssh
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Terminal className="w-4 h-4" />
          SSH
        </button>

        <button
          onClick={() => onRDPClick?.(device)}
          disabled={!isOnline || !device.capabilities.rdp}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            isOnline && device.capabilities.rdp
              ? 'bg-orange-600 hover:bg-orange-700 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          <MonitorPlay className="w-4 h-4" />
          RDP
        </button>
      </div>
    </div>
  );
}
