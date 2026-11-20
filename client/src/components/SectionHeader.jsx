import React from 'react';
import { Reveal } from './motion/MotionSystem';

const SectionHeader = ({ eyebrow, title, description, align = 'center' }) => {
  const alignment = align === 'left' ? 'items-start text-left' : 'items-center text-center mx-auto';

  return (
    <Reveal direction="up" distance={20} duration={580} className={`max-w-3xl ${alignment}`}>
      {eyebrow && (
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-7 text-muted sm:text-lg">
          {description}
        </p>
      )}
    </Reveal>
  );
};

export default SectionHeader;
