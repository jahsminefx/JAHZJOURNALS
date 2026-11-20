import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const MOTION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const MAX_STAGGER_DELAY_MS = 420;

const StaggerContext = createContext({
  isVisible: true,
  staggerDelay: 70,
  reducedMotion: false,
});

/**
 * Subscribe to the user's OS reduced-motion preference.
 */
export const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event) => {
      setReducedMotion(event.matches);
    };

    setReducedMotion(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return reducedMotion;
};

const getHiddenTransform = (direction, distance, scale) => {
  let translate = 'translate3d(0, 0, 0)';
  if (direction === 'up') translate = `translate3d(0, ${distance}px, 0)`;
  else if (direction === 'down') translate = `translate3d(0, -${distance}px, 0)`;
  else if (direction === 'left') translate = `translate3d(${distance}px, 0, 0)`;
  else if (direction === 'right') translate = `translate3d(-${distance}px, 0, 0)`;

  if (scale !== 1) {
    return `${translate} scale3d(${scale}, ${scale}, 1)`;
  }
  return translate;
};

const getVisibleTransform = (scale) =>
  scale !== 1 ? 'translate3d(0, 0, 0) scale3d(1, 1, 1)' : 'translate3d(0, 0, 0)';

/**
 * Immediate mount entrance animation for above-the-fold hero content.
 */
export const FadeIn = ({
  children,
  direction = 'up',
  delay = 0,
  duration = 600,
  distance = 18,
  scale = 1,
  as: Component = 'div',
  className = '',
  style,
  ...rest
}) => {
  const reducedMotion = useReducedMotion();
  const isBrowser = typeof window !== 'undefined';
  const [isVisible, setIsVisible] = useState(() => !isBrowser || reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setIsVisible(true);
      return undefined;
    }

    let raf1 = 0;
    let raf2 = 0;

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [reducedMotion]);

  const motionStyle = reducedMotion
    ? { opacity: 1, transform: 'none', ...style }
    : {
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? getVisibleTransform(scale)
          : getHiddenTransform(direction, distance, scale),
        transitionProperty: 'opacity, transform',
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: MOTION_EASING,
        transitionDelay: `${delay}ms`,
        ...style,
      };

  return (
    <Component className={`motion-reveal ${className}`.trim()} style={motionStyle} {...rest}>
      {children}
    </Component>
  );
};

/**
 * Scroll-triggered viewport reveal using a single IntersectionObserver lifecycle.
 */
export const Reveal = ({
  children,
  direction = 'up',
  delay = 0,
  duration = 580,
  distance = 22,
  scale = 1,
  threshold = 0.12,
  rootMargin = '0px 0px -40px 0px',
  once = true,
  as: Component = 'div',
  className = '',
  style,
  ...rest
}) => {
  const reducedMotion = useReducedMotion();
  const ref = useRef(null);
  const supportsObserver =
    typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined';
  const [isVisible, setIsVisible] = useState(() => !supportsObserver || reducedMotion);

  useEffect(() => {
    if (reducedMotion || !supportsObserver) {
      setIsVisible(true);
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once) {
              observer.disconnect();
            }
          } else if (!once) {
            setIsVisible(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, supportsObserver, threshold, rootMargin, once]);

  const motionStyle = reducedMotion
    ? { opacity: 1, transform: 'none', ...style }
    : {
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? getVisibleTransform(scale)
          : getHiddenTransform(direction, distance, scale),
        transitionProperty: 'opacity, transform',
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: MOTION_EASING,
        transitionDelay: `${delay}ms`,
        ...style,
      };

  return (
    <Component
      ref={ref}
      className={`motion-reveal ${className}`.trim()}
      style={motionStyle}
      {...rest}
    >
      {children}
    </Component>
  );
};

/**
 * Coordinates staggered entrance timing for groups of cards or items on scroll.
 */
export const StaggerContainer = ({
  children,
  staggerDelay = 70,
  threshold = 0.08,
  rootMargin = '0px 0px -32px 0px',
  once = true,
  as: Component = 'div',
  className = '',
  ...rest
}) => {
  const reducedMotion = useReducedMotion();
  const ref = useRef(null);
  const supportsObserver =
    typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined';
  const [isVisible, setIsVisible] = useState(() => !supportsObserver || reducedMotion);

  useEffect(() => {
    if (reducedMotion || !supportsObserver) {
      setIsVisible(true);
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once) {
              observer.disconnect();
            }
          } else if (!once) {
            setIsVisible(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, supportsObserver, threshold, rootMargin, once]);

  const contextValue = useMemo(
    () => ({ isVisible, staggerDelay, reducedMotion }),
    [isVisible, staggerDelay, reducedMotion]
  );

  return (
    <StaggerContext.Provider value={contextValue}>
      <Component ref={ref} className={className} {...rest}>
        {children}
      </Component>
    </StaggerContext.Provider>
  );
};

/**
 * Child item inside StaggerContainer with capped delay for crisp pacing.
 */
export const StaggerItem = ({
  children,
  index = 0,
  direction = 'up',
  duration = 540,
  distance = 20,
  scale = 1,
  as: Component = 'div',
  className = '',
  style,
  ...rest
}) => {
  const { isVisible, staggerDelay, reducedMotion } = useContext(StaggerContext);
  const computedDelay = Math.min(index * staggerDelay, MAX_STAGGER_DELAY_MS);

  const motionStyle = reducedMotion
    ? { opacity: 1, transform: 'none', ...style }
    : {
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? getVisibleTransform(scale)
          : getHiddenTransform(direction, distance, scale),
        transitionProperty: 'opacity, transform',
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: MOTION_EASING,
        transitionDelay: `${computedDelay}ms`,
        ...style,
      };

  return (
    <Component className={`motion-reveal ${className}`.trim()} style={motionStyle} {...rest}>
      {children}
    </Component>
  );
};

/**
 * Section wrapper with standardized scroll reveal.
 */
export const AnimatedSection = ({
  children,
  as = 'section',
  distance = 24,
  duration = 620,
  threshold = 0.08,
  className = '',
  ...rest
}) => (
  <Reveal
    as={as}
    distance={distance}
    duration={duration}
    threshold={threshold}
    className={className}
    {...rest}
  >
    {children}
  </Reveal>
);

/**
 * Reusable card wrapper providing restrained lift and optional emerald border/shadow glow.
 */
export const MotionCard = ({
  children,
  glow = true,
  reveal = false,
  delay = 0,
  as: Component = 'div',
  className = '',
  ...rest
}) => {
  const cardClasses = `motion-card-hover ${glow ? 'motion-card-glow' : ''} ${className}`.trim();

  if (reveal) {
    return (
      <Reveal as={Component} delay={delay} className={cardClasses} {...rest}>
        {children}
      </Reveal>
    );
  }

  return (
    <Component className={cardClasses} {...rest}>
      {children}
    </Component>
  );
};

/**
 * Subtle continuous floating container for product mockups and showcase visuals.
 */
export const FloatingVisual = ({
  children,
  ambientGlow = false,
  className = '',
  ...rest
}) => (
  <div className={`relative motion-float-subtle ${className}`.trim()} {...rest}>
    {ambientGlow && (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-transparent blur-2xl opacity-80"
      />
    )}
    {children}
  </div>
);

/**
 * Smooth count-up animation for genuine metrics that triggers once on viewport entry.
 */
export const CountUpNumber = ({ value, duration = 1100, className = '' }) => {
  const rawValue = String(value ?? '');
  const reducedMotion = useReducedMotion();
  const ref = useRef(null);
  const parsed = useMemo(() => {
    const match = rawValue.match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
    if (!match) return null;

    const [, prefix, numText, suffix] = match;
    const numericTarget = Number(numText.replace(/,/g, ''));
    if (!Number.isFinite(numericTarget)) return null;

    const decimalPart = numText.split('.')[1];
    return {
      prefix,
      target: numericTarget,
      decimals: decimalPart ? decimalPart.length : 0,
      hasCommas: numText.includes(','),
      suffix,
    };
  }, [rawValue]);

  const [displayValue, setDisplayValue] = useState(rawValue);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    setDisplayValue(rawValue);
    hasAnimatedRef.current = false;
  }, [rawValue]);

  useEffect(() => {
    if (!parsed || reducedMotion || typeof window === 'undefined') {
      setDisplayValue(rawValue);
      return undefined;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setDisplayValue(rawValue);
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;

    let rafId = 0;

    const startAnimation = () => {
      if (hasAnimatedRef.current) return;
      hasAnimatedRef.current = true;

      const startTime = performance.now();

      const formatAnimated = (current) => {
        const rounded =
          parsed.decimals > 0 ? current.toFixed(parsed.decimals) : String(Math.round(current));
        if (!parsed.hasCommas) {
          return `${parsed.prefix}${rounded}${parsed.suffix}`;
        }
        const [intPart, decPart] = rounded.split('.');
        const formattedInt = Number(intPart).toLocaleString('en-US');
        return `${parsed.prefix}${decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt}${parsed.suffix}`;
      };

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = parsed.target * eased;

        if (progress >= 1) {
          setDisplayValue(rawValue);
          return;
        }

        setDisplayValue(formatAnimated(currentValue));
        rafId = window.requestAnimationFrame(step);
      };

      rafId = window.requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startAnimation();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [parsed, rawValue, duration, reducedMotion]);

  if (!parsed) {
    return <span className={className}>{rawValue}</span>;
  }

  return (
    <span ref={ref} aria-label={rawValue} className={`tabular-nums ${className}`.trim()}>
      <span aria-hidden="true">{displayValue}</span>
      <span className="sr-only">{rawValue}</span>
    </span>
  );
};
