import { useRef, useState, useCallback } from 'react';
import { Terminal, TerminalHandle } from './Terminal';
import { TerminalToolbar } from './TerminalToolbar';
import type { Device } from '../../types/device';

interface TerminalViewProps {
  device: Device;
  onClose?: () => void;
}

export function TerminalView({ device, onClose }: TerminalViewProps) {
  const terminalRef = useRef<TerminalHandle>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleData = useCallback((data: string) => {
    // TODO: Send data via WebSocket
    console.log('Terminal data:', data);
  }, []);

  const handleResize = useCallback((cols: number, rows: number) => {
    // TODO: Send resize via WebSocket
    console.log('Terminal resize:', cols, rows);
  }, []);

  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const handleCopy = useCallback(async () => {
    // Get selected text from terminal (if any) and copy to clipboard
    const selection = window.getSelection()?.toString();
    if (selection) {
      await navigator.clipboard.writeText(selection);
    }
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Simulate connection (TODO: Replace with actual WebSocket connection)
  useState(() => {
    const timer = setTimeout(() => {
      setIsConnected(true);
      terminalRef.current?.write('\x1b[32mConnected to ' + device.name + '\x1b[0m\r\n');
      terminalRef.current?.write('$ ');
    }, 500);
    return () => clearTimeout(timer);
  });

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-[#0a0a0a] rounded-lg overflow-hidden border border-gray-800 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'h-[500px]'
      }`}
    >
      <TerminalToolbar
        deviceName={device.name}
        isConnected={isConnected}
        isFullscreen={isFullscreen}
        onClear={handleClear}
        onCopy={handleCopy}
        onToggleFullscreen={handleToggleFullscreen}
        onClose={onClose}
      />
      <div className="flex-1 overflow-hidden">
        <Terminal
          ref={terminalRef}
          onData={handleData}
          onResize={handleResize}
        />
      </div>
    </div>
  );
}
