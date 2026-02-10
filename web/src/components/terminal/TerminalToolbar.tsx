import { Trash2, Copy, Maximize2, Minimize2, Circle } from 'lucide-react';

interface TerminalToolbarProps {
  deviceName: string;
  isConnected: boolean;
  isFullscreen?: boolean;
  onClear?: () => void;
  onCopy?: () => void;
  onToggleFullscreen?: () => void;
  onClose?: () => void;
}

export function TerminalToolbar({
  deviceName,
  isConnected,
  isFullscreen = false,
  onClear,
  onCopy,
  onToggleFullscreen,
  onClose,
}: TerminalToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-gray-800">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Circle
            className={`w-3 h-3 ${isConnected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`}
          />
          <span className="text-sm font-medium text-white">{deviceName}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${
          isConnected 
            ? 'bg-green-500/10 text-green-400' 
            : 'bg-red-500/10 text-red-400'
        }`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onCopy}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Copy"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onClear}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Clear"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleFullscreen}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors ml-2"
            title="Close"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        )}
      </div>
    </div>
  );
}
