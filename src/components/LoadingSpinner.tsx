import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  accentColor?: string;
  className?: string;
  lightTrack?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-[2.5px]',
  lg: 'h-9 w-9 border-[3px]',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label,
  accentColor,
  className = '',
  lightTrack = false,
}) => {
  const trackClass = lightTrack
    ? 'border-white/30 border-t-white'
    : 'border-slate-200 dark:border-slate-700';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2.5 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 animate-spin rounded-full ${SIZE_CLASSES[size]} ${trackClass}`}
        style={
          !lightTrack && accentColor
            ? { borderTopColor: accentColor }
            : undefined
        }
      />
      {label ? (
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {label}
        </span>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
};
