import { useState, useEffect, useRef, useCallback } from 'react';

const EDGE_MARGIN = 20; // 20px margin from screen edges
const DRAG_THRESHOLD = 6; // 6px movement required to count as drag

export function useDraggable(storageKey, initialDefaultPos = { x: 0, y: 0 }) {
  // Load saved position from localStorage or default
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch (_) {}
    return initialDefaultPos;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const elementStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const containerRef = useRef(null);

  // Helper to clamp position within viewport boundaries
  const clampPosition = useCallback((x, y) => {
    if (!containerRef.current) return { x, y };

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width || 60;
    const height = rect.height || 60;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Minimum & maximum allowed coordinates relative to initial position
    // Since style uses translate(x, y), we compute bounds based on current translate offset
    const minX = - (windowWidth - rect.right - EDGE_MARGIN);
    const maxX = rect.left - EDGE_MARGIN;

    const minY = - (windowHeight - rect.bottom - EDGE_MARGIN);
    const maxY = rect.top - EDGE_MARGIN;

    // Clamp coordinates
    const clampedX = Math.max(- (windowWidth - width - EDGE_MARGIN * 2), Math.min(0, x));
    const clampedY = Math.max(- (windowHeight - height - EDGE_MARGIN * 2), Math.min(0, y));

    return { x: clampedX, y: clampedY };
  }, []);

  // Save position to localStorage
  const savePosition = useCallback((newPos) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPos));
    } catch (_) {}
  }, [storageKey]);

  // Recalculate boundaries on window resize
  useEffect(() => {
    const handleResize = () => {
      setPos((current) => {
        const clamped = clampPosition(current.x, current.y);
        if (clamped.x !== current.x || clamped.y !== current.y) {
          savePosition(clamped);
          return clamped;
        }
        return current;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition, savePosition]);

  // Pointer Down (Mouse or Touch)
  const onPointerDown = useCallback((e) => {
    // Only primary button for mouse
    if (e.button !== undefined && e.button !== 0) return;

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    if (clientX === undefined || clientY === undefined) return;

    isDraggingRef.current = true;
    hasMovedRef.current = false;

    dragStartRef.current = { x: clientX, y: clientY };
    elementStartPosRef.current = { ...pos };

    const handlePointerMove = (moveEvt) => {
      if (!isDraggingRef.current) return;

      const moveX = moveEvt.clientX ?? moveEvt.touches?.[0]?.clientX;
      const moveY = moveEvt.clientY ?? moveEvt.touches?.[0]?.clientY;

      if (moveX === undefined || moveY === undefined) return;

      const deltaX = moveX - dragStartRef.current.x;
      const deltaY = moveY - dragStartRef.current.y;

      const distance = Math.hypot(deltaX, deltaY);

      if (distance > DRAG_THRESHOLD) {
        hasMovedRef.current = true;
        setIsDragging(true);
        if (moveEvt.cancelable) {
          moveEvt.preventDefault(); // Prevent page scrolling during drag
        }
      }

      if (hasMovedRef.current) {
        const rawX = elementStartPosRef.current.x + deltaX;
        const rawY = elementStartPosRef.current.y + deltaY;
        const clamped = clampPosition(rawX, rawY);
        setPos(clamped);
      }
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);

        setPos((latestPos) => {
          savePosition(latestPos);
          return latestPos;
        });
      }

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  }, [pos, clampPosition, savePosition]);

  return {
    pos,
    isDragging,
    hasMoved: hasMovedRef.current,
    containerRef,
    pointerHandlers: {
      onPointerDown,
      onTouchStart: onPointerDown,
    },
    style: {
      transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
      touchAction: 'none',
    },
    resetPos: () => {
      setPos({ x: 0, y: 0 });
      try {
        localStorage.removeItem(storageKey);
      } catch (_) {}
    }
  };
}

export default useDraggable;
