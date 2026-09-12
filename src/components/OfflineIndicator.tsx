import React from 'react';
import { useOnlineStatus } from '../utils/usePWAInstall';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/95 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-white shadow-lg border border-amber-400/30 animate-pulse">
      <WifiOff className="w-4 h-4 text-white shrink-0" />
      <span>حالت آفلاین — برنامه بدون اتصال به اینترنت در دسترس است</span>
    </div>
  );
};
