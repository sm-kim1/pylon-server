import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

export interface TerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
  getSize: () => { cols: number; rows: number };
}

interface TerminalProps {
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  className?: string;
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  ({ onData, onResize, className = '' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const fontFamily = "'JetBrainsMono Nerd Font Mono', monospace";

    const fit = useCallback(() => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = terminalRef.current;
        onResize?.(cols, rows);
      }
    }, [onResize]);

    useImperativeHandle(ref, () => ({
      write: (data: string) => {
        terminalRef.current?.write(data);
      },
      clear: () => {
        terminalRef.current?.clear();
      },
      focus: () => {
        terminalRef.current?.focus();
      },
      fit,
      getSize: () => {
        const term = terminalRef.current;
        return { cols: term?.cols ?? 80, rows: term?.rows ?? 24 };
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      let cancelled = false;

      const init = async () => {
        if (document.fonts?.load) {
          try {
            await document.fonts.load(`14px ${fontFamily}`);
          } catch (err) {
            console.warn('Failed to preload terminal font:', err);
          }
        }

        if (cancelled || !containerRef.current) return;

        const terminal = new XTerm({
        theme: {
          background: '#0a0a0a',
          foreground: '#e0e0e0',
          cursor: '#e0e0e0',
          cursorAccent: '#0a0a0a',
          selectionBackground: '#3b82f6',
          selectionForeground: '#ffffff',
          black: '#000000',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#e0e0e0',
          brightBlack: '#6b7280',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff',
        },
        fontFamily,
        fontSize: 14,
        lineHeight: 1.2,
        fontWeight: '400',
        fontWeightBold: '700',
        cursorStyle: 'bar',
        cursorBlink: true,
        scrollback: 1000,
        allowTransparency: true,
        convertEol: true,
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);

        terminal.open(containerRef.current);
        fitAddon.fit();

        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;

        // Handle user input
        terminal.onData((data) => {
          onData?.(data);
        });

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
          fitAddon.fit();
          onResize?.(terminal.cols, terminal.rows);
        });
        resizeObserver.observe(containerRef.current);

        // Initial resize callback
        onResize?.(terminal.cols, terminal.rows);

        return () => {
          resizeObserver.disconnect();
          terminal.dispose();
        };
      };

      const cleanup = init();

      return () => {
        cancelled = true;
        if (cleanup && typeof cleanup.then === 'function') {
          cleanup.then((fn) => {
            if (typeof fn === 'function') fn();
          });
        }
      };
    }, [onData, onResize]);

    return (
      <div
        ref={containerRef}
        className={`w-full h-full min-h-[300px] ${className}`}
        style={{ backgroundColor: '#0a0a0a' }}
      />
    );
  }
);

Terminal.displayName = 'Terminal';
