import React from 'react';

/**
 * Safely renders inline formatting (**bold**, *italic*, __underline__) as React elements
 * without raw HTML injection.
 */
export function renderFormattedText(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => (
    <React.Fragment key={lineIdx}>
      {parseInlineTokens(line)}
      {lineIdx < lines.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
}

function parseInlineTokens(line: string): React.ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__)/g;
  const parts = line.split(pattern);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
      return (
        <span key={idx} className="underline decoration-slate-400 underline-offset-2">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}
