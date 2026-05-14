"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({ 
  checked, 
  onChange, 
  disabled = false,
  className,
  size = 'md'
}) => {
  return (
    <div className={cn("shrink-0 flex items-center", className)}>
      <label className={cn("toggle-switch", size === 'sm' && "toggle-sm")}>
        <input 
          type="checkbox" 
          className="toggle-input" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className="toggle-label" />
      </label>
    </div>
  );
};
