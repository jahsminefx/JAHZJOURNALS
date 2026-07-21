import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const DirectionSelect = ({ value, onChange, onBlur }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onBlur]);

  return (
    <div className="relative mt-1 block w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none ${isOpen ? 'border-green-500' : ''}`}
      >
        <span>{value === 'SELL' ? 'Short / Sell' : 'Long / Buy'}</span>
        <ChevronDown size={16} className="text-muted" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-md shadow-lg overflow-hidden py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-green-600 hover:text-white transition-colors text-sm"
            onClick={() => {
              onChange('BUY');
              setIsOpen(false);
            }}
          >
            Long / Buy
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-red-600 hover:text-white transition-colors text-sm"
            onClick={() => {
              onChange('SELL');
              setIsOpen(false);
            }}
          >
            Short / Sell
          </button>
        </div>
      )}
    </div>
  );
};

export default DirectionSelect;
