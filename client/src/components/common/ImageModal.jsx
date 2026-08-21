import React, { useEffect, useState } from 'react';
import { X, ExternalLink, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { resolveImageUrl } from '../../utils/api';

const ImageModal = ({ isOpen, onClose, imageUrl, title, note }) => {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setZoom(1);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const fullUrl = resolveImageUrl(imageUrl);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col max-h-[95vh] max-w-[95vw] w-full lg:w-auto rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-foreground">{title || 'Chart Screenshot'}</p>
            {note && <span className="text-xs text-muted">({note})</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleZoomOut}
              className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground transition-colors"
              title="Zoom out"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-xs font-medium text-muted">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground transition-colors"
              title="Zoom in"
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground transition-colors"
              title="Reset zoom"
            >
              <RotateCcw size={16} />
            </button>
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground transition-colors"
              title="Open full resolution in new tab"
            >
              <ExternalLink size={18} />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted hover:bg-red-500/20 hover:text-red-300 transition-colors"
              title="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Image Container */}
        <div className="flex items-center justify-center p-4 bg-background/50 overflow-auto max-h-[80vh]">
          <img
            src={fullUrl}
            alt={title || 'Chart Screenshot'}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className="max-h-[75vh] max-w-full rounded-lg object-contain transition-transform duration-150 shadow-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
