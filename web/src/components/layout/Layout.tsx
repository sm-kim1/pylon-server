import { ReactNode } from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
  deviceCount?: number;
  isConnected?: boolean;
}

export function Layout({ children, deviceCount = 0, isConnected = true }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Header deviceCount={deviceCount} isConnected={isConnected} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
