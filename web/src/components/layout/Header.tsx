import { Server, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  isConnected?: boolean;
  deviceCount?: number;
}

export function Header({ isConnected = true, deviceCount = 0 }: HeaderProps) {
  return (
    <header className="bg-[#1a1a1a] border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Server className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-xl font-bold text-white">Pylon</h1>
            <p className="text-sm text-gray-400">SSH Terminal & RDP Remote Access</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-sm text-gray-400">
            <span className="text-white font-medium">{deviceCount}</span> device{deviceCount !== 1 ? 's' : ''} connected
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="w-5 h-5 text-green-500" />
                <span className="text-sm text-green-500">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-500" />
                <span className="text-sm text-red-500">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
