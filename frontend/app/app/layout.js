'use client';

import Sidebar from '../../components/Sidebar';

export default function AppLayout({ children }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-nature-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
