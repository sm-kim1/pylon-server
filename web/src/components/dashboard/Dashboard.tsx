import { useState, useCallback, useRef, useEffect } from 'react';
import { useDevices } from '../../hooks/useDevices';
import { useWebSocket } from '../../hooks/useWebSocket';
import { DeviceList } from './DeviceList';
import { Layout } from '../layout/Layout';
import { SSHTerminal } from '../terminal/SSHTerminal';
import { RDPViewer } from '../rdp/RDPViewer';
import { RefreshCw, X } from 'lucide-react';
import type { Device } from '../../types/device';

type ActiveView =
  | { type: 'ssh'; device: Device }
  | { type: 'rdp'; device: Device }
  | null;

const MIN_WIDTH = 480;
const MIN_HEIGHT = 300;
const EDGE_PADDING = 32;

const DEFAULT_SIZES = {
  ssh: { width: 900, height: 500 },
  rdp: { width: 1024, height: 768 },
} as const;

export function Dashboard() {
  useWebSocket();
  const { devices, loading, error, refresh, lastUpdated } = useDevices();
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [modalSize, setModalSize] = useState({ width: 900, height: 500 });
  const resizingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleSSHClick = useCallback((device: Device) => {
    setModalSize(DEFAULT_SIZES.ssh);
    setActiveView({ type: 'ssh', device });
  }, []);

  const handleRDPClick = useCallback((device: Device) => {
    setModalSize(DEFAULT_SIZES.rdp);
    setActiveView({ type: 'rdp', device });
  }, []);

  const handleCloseView = useCallback(() => {
    setActiveView(null);
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startRef.current = { x: e.clientX, y: e.clientY, w: modalSize.width, h: modalSize.height };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const maxW = window.innerWidth - EDGE_PADDING * 2;
      const maxH = window.innerHeight - EDGE_PADDING * 2;
      const newW = Math.min(maxW, Math.max(MIN_WIDTH, startRef.current.w + (ev.clientX - startRef.current.x)));
      const newH = Math.min(maxH, Math.max(MIN_HEIGHT, startRef.current.h + (ev.clientY - startRef.current.y)));
      setModalSize({ width: newW, height: newH });
    };

    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [modalSize]);

  // Clamp modal size if window shrinks
  useEffect(() => {
    const onResize = () => {
      setModalSize((prev) => ({
        width: Math.min(prev.width, window.innerWidth - EDGE_PADDING * 2),
        height: Math.min(prev.height, window.innerHeight - EDGE_PADDING * 2),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <Layout deviceCount={devices.filter(d => d.status === 'online').length}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Devices</h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage your connected devices
          </p>
        </div>

        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <DeviceList
        devices={devices}
        loading={loading}
        error={error}
        onSSHClick={handleSSHClick}
        onRDPClick={handleRDPClick}
      />

      {activeView && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div
            className="relative"
            style={{ width: modalSize.width, height: modalSize.height }}
          >
            <button
              onClick={handleCloseView}
              className="absolute -top-10 right-0 p-2 text-gray-400 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>

            {activeView.type === 'ssh' && (
              <SSHTerminal device={activeView.device} onClose={handleCloseView} />
            )}

            {activeView.type === 'rdp' && (
              <RDPViewer device={activeView.device} onClose={handleCloseView} />
            )}

            {/* Resize handle */}
            <div
              onMouseDown={handleResizeMouseDown}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
              title="Drag to resize"
            >
              <svg
                className="w-4 h-4 text-gray-500"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14ZM14 6H12V4H14V6ZM10 10H8V8H10V10ZM6 14H4V12H6V14Z" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
