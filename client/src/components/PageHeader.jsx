import React from 'react';
import Button from './Button';
import { FadeIn } from './motion/MotionSystem';

const PageHeader = ({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  heroImage,
  heroAlt = '',
  heroPosition = {},
  compact = false,
  contentClassName = '',
  className = '',
}) => {
  const hasHeroImage = Boolean(heroImage);
  const sectionClasses = hasHeroImage
    ? `relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800/80 dark:border-white/10 bg-slate-950 shadow-xl flex items-center ${
        compact
          ? 'min-h-[260px] sm:min-h-[300px] lg:min-h-[340px] px-5 py-8 sm:px-10 sm:py-11 lg:px-14 lg:py-12'
          : 'min-h-[320px] sm:min-h-[370px] lg:min-h-[420px] px-5 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16'
      } ${className}`
    : `relative overflow-hidden px-4 pb-14 pt-28 sm:px-6 lg:px-8 ${className}`;

  const contentWrapperClasses = hasHeroImage
    ? `relative z-20 mx-auto w-full max-w-7xl`
    : 'relative z-20 mx-auto max-w-4xl text-center';

  const textBlockClasses = hasHeroImage
    ? `text-left ${contentClassName || 'max-w-xl lg:max-w-[36rem]'}`
    : '';

  return (
    <section className={sectionClasses}>
      {hasHeroImage ? (
        <>
          <img
            src={heroImage}
            alt={heroAlt}
            className="hero-media hero-ken-burns absolute inset-0 z-0 h-full w-full object-cover"
            style={{
              '--hero-position-mobile': heroPosition.mobile || '72% 40%',
              '--hero-position-tablet': heroPosition.tablet || '66% 42%',
              '--hero-position-desktop': heroPosition.desktop || '60% 42%',
              '--hero-position-xl': heroPosition.xl || heroPosition.desktop || '58% 42%',
            }}
          />
          <div className="hero-overlay-split absolute inset-0 z-10" />
        </>
      ) : (
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.14),transparent_40%)]" />
      )}

      <div className={contentWrapperClasses}>
        <div className={textBlockClasses}>
          {eyebrow && (
            <FadeIn direction="up" delay={0} duration={550} distance={14}>
              <p className={`text-xs font-bold uppercase tracking-[0.26em] ${hasHeroImage ? 'text-emerald-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {eyebrow}
              </p>
            </FadeIn>
          )}
          <FadeIn direction="up" delay={90} duration={650} distance={20}>
            <h1
              className={`mt-4 font-black tracking-tight ${
                compact ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-3xl sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]'
              } ${hasHeroImage ? 'text-white drop-shadow-sm' : 'text-foreground'}`}
            >
              {title}
            </h1>
          </FadeIn>
          {description && (
            <FadeIn direction="up" delay={180} duration={650} distance={18}>
              <p
                className={`mt-4 text-base leading-7 sm:text-lg ${
                  hasHeroImage ? 'max-w-xl text-slate-200 font-medium' : 'mx-auto mt-5 max-w-2xl text-muted'
                }`}
              >
                {description}
              </p>
            </FadeIn>
          )}
          {(primaryCta || secondaryCta) && (
            <FadeIn direction="up" delay={270} duration={650} distance={16}>
              <div className={`mt-7 flex flex-col gap-3 sm:flex-row sm:items-center ${hasHeroImage ? 'justify-start' : 'justify-center'}`}>
                {primaryCta && (
                  <Button
                    to={primaryCta.to}
                    href={primaryCta.href}
                    onClick={primaryCta.onClick}
                    size={compact ? 'md' : 'lg'}
                  >
                    {primaryCta.label}
                  </Button>
                )}
                {secondaryCta && (
                  <Button
                    to={secondaryCta.to}
                    href={secondaryCta.href}
                    onClick={secondaryCta.onClick}
                    variant="secondary"
                    size={compact ? 'md' : 'lg'}
                    className={hasHeroImage ? '!border-white/25 !bg-white/10 !text-white hover:!bg-white/20 backdrop-blur-sm' : ''}
                  >
                    {secondaryCta.label}
                  </Button>
                )}
              </div>
            </FadeIn>
          )}
        </div>
      </div>
    </section>
  );
};

export default PageHeader;
