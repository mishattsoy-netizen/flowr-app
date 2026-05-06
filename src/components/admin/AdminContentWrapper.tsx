"use client";

import { usePathname } from 'next/navigation';
import React from 'react';
import clsx from 'clsx';

export function AdminContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Pages that should be expansive (full width, custom centering)
  const isExpansive = pathname === '/admin/bot/brain';

  if (isExpansive) {
    return (
      <div className="min-h-full relative">
        {children}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto min-h-full">
      {children}
    </div>
  );
}
