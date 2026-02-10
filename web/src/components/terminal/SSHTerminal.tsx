import { useRef, useCallback, useEffect, useState } from 'react';
import { Terminal, TerminalHandle } from './Terminal';
import { TerminalToolbar } from './TerminalToolbar';
import { useSSHSession } from '../../hooks/useSSHSession';
import type { Device } from '../../types/device';

interface SSHTerminalProps {
  device: Device;
  onClose?: () => void;
}

export function SSHTerminal({ device, onClose }: SSHTerminalProps) {
  const terminalRef = useRef<TerminalHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    status,
    error,
    wsConnected,
    connect,
    disconnect,
    sendData,
    sendResize,
  } = useSSHSession({
    deviceId: device.id,
    terminalRef,
    onConnect: () => {
      terminalRef.current?.write('\x1b[32mConnected to ' + device.name + '\x1b[0m\r\n');
      terminalRef.current?.focus();
    },
    onDisconnect: () => {
      terminalRef.current?.write('\r\n\x1b[33mDisconnected\x1b[0m\r\n');
    },
    onError: (err) => {
      terminalRef.current?.write('\r\n\x1b[31mError: ' + err + '\x1b[0m\r\n');
    },
  });

  // Auto-connect when component mounts
  useEffect(() => {
    if (wsConnected && status === 'disconnected') {
      terminalRef.current?.write('\x1b[33mConnecting to ' + device.name + '...\x1b[0m\r\n');
      connect();
    }
  }, [wsConnected, status, device.name, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const handleData = useCallback((data: string) => {
    sendData(data);
  }, [sendData]);

  const handleResize = useCallback((cols: number, rows: number) => {
    sendResize(cols, rows);
  }, [sendResize]);

  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const handleCopy = useCallback(async () => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      await navigator.clipboard.writeText(selection);
    }
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    disconnect();
    onClose?.();
  }, [disconnect, onClose]);

  const isConnected = status === 'connected';

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-[#0a0a0a] overflow-hidden border border-gray-800 ${
        isFullscreen ? 'fixed inset-0 z-[60] rounded-none border-0' : 'h-full rounded-lg'
      }`}
    >
      <TerminalToolbar
        deviceName={device.name}
        isConnected={isConnected}
        isFullscreen={isFullscreen}
        onClear={handleClear}
        onCopy={handleCopy}
        onToggleFullscreen={handleToggleFullscreen}
        onClose={handleClose}
      />
      
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 text-red-400 text-sm">
          {error}
        </div>
      )}
      
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
