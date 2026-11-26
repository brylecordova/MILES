import React, { useEffect, useState } from 'react';
import { BookOpen, Film, ImageIcon } from 'lucide-react';

interface MediaRendererProps {
  type: 'image' | 'video';
  url: string;
  caption?: string;
  offlineBlobs?: Record<string, Blob>;
  className?: string;
}

export const MediaRenderer: React.FC<MediaRendererProps> = ({
  type,
  url,
  caption,
  offlineBlobs,
  className = '',
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(url);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    const blob = offlineBlobs?.[url];
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      setResolvedSrc(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setResolvedSrc(url);
    return undefined;
  }, [url, offlineBlobs]);

  if (!url || hasError) {
    return (
      <figure
        className={`rounded-xl border border-slate-200 bg-slate-100 p-6 text-center dark:border-slate-800 dark:bg-slate-900 ${className}`}
      >
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {type === 'video' ? <Film className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {type === 'video' ? 'Training Video' : 'Lesson Illustration'}
        </p>
        {caption && (
          <figcaption className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <figure
      className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-950/5 dark:border-slate-800 dark:bg-slate-950/40 ${className}`}
    >
      {type === 'video' ? (
        <video
          src={resolvedSrc}
          controls
          playsInline
          preload="metadata"
          onError={() => setHasError(true)}
          className="aspect-video w-full bg-slate-950 object-contain"
        />
      ) : (
        <img
          src={resolvedSrc}
          alt={caption || 'Lesson visual aid'}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="max-h-[420px] w-full bg-slate-100 object-cover dark:bg-slate-900"
        />
      )}
      {caption && (
        <figcaption className="border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

interface CourseBannerProps {
  url: string;
  title: string;
  offlineBlobs?: Record<string, Blob>;
  className?: string;
}

export const CourseBannerImage: React.FC<CourseBannerProps> = ({
  url,
  title,
  offlineBlobs,
  className = '',
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(url);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    const blob = offlineBlobs?.[url];
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      setResolvedSrc(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setResolvedSrc(url);
    return undefined;
  }, [url, offlineBlobs]);

  if (!url || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 p-6 text-white ${className}`}
      >
        <BookOpen className="mb-2 h-7 w-7 text-sky-300" />
        <span className="line-clamp-1 text-center text-xs font-medium text-slate-200">{title}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={title}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`object-cover ${className}`}
    />
  );
};
