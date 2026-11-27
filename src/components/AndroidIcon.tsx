import React from 'react';

interface AndroidIconProps {
  className?: string;
  'data-testid'?: string;
}

export const AndroidIcon: React.FC<AndroidIconProps> = ({
  className,
  'data-testid': testId,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    fillRule="evenodd"
    aria-hidden="true"
    data-testid={testId}
    className={className}
  >
    <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM9.75 4.2a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm4.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z" />
  </svg>
);
