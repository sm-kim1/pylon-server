import { X, Maximize2, Minimize2, Keyboard, Mouse } from 'lucide-react';

interface RDPToolbarProps {
  deviceName: string;
  isConnected: boolean;
  isFullscreen: boolean;
  inputEnabled: boolean;
  onToggleFullscreen: () => void;
  onToggleInput: () => void;
  onClose: () => void;
}

export function RDPToolbar({
  deviceName,
  isConnected,
  isFullscreen,
  inputEnabled,
  onToggleFullscreen,
  onToggleInput,
  onClose,
}: RDPToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 min-h-[60px] shrink-0 bg-[#111] border-b border-gray-800">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-yellow-500 animate-pulse'
          }`}
        />
        <span className="text-sm font-medium text-white">{deviceName}</span>
        <span className="text-xs text-gray-500">
          {isConnected ? 'Connected' : 'Connecting...'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleInput}
          className={`p-2 rounded transition-colors flex items-center justify-center leading-none ${
            inputEnabled
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title={inputEnabled ? 'Input enabled' : 'Input disabled'}
        >
          <div className="flex items-center gap-1">
            <Keyboard className="w-4 h-4" />
            <Mouse className="w-4 h-4" />
          </div>
        </button>

        <button
          onClick={onToggleFullscreen}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors flex items-center justify-center leading-none"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors flex items-center justify-center leading-none"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
