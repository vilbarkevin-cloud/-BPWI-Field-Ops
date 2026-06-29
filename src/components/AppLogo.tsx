import React from 'react';

interface AppLogoProps {
  className?: string;
}

export function AppLogo({ className = "w-10 h-10" }: AppLogoProps) {
  return (
    <img 
      src="/logo.png" 
      alt="BPWI Logo" 
      className={`object-contain dark:invert dark:hue-rotate-180 ${className}`}
      onError={(e) => {
        // Fallback styling if the image is not yet uploaded
        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300AEEF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'/%3E%3C/svg%3E";
      }}
    />
  );
}

