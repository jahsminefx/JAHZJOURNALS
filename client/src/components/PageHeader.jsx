import React from 'react';
import Button from './Button';

const PageHeader = ({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  heroImage,
  heroAlt = '',
  heroPosition = {},
}) => (
  <section className="relative overflow-hidden px-4 pb-14 pt-28 sm:px-6 lg:px-8">
    {heroImage ? (
      <>
        <img
          src={heroImage}
          alt={heroAlt}
          className="hero-media absolute inset-0 z-0 h-full w-full object-cover brightness-[1.6]"
          style={{
            '--hero-position-mobile': heroPosition.mobile || '68% top',
            '--hero-position-tablet': heroPosition.tablet || '60% top',
            '--hero-position-desktop': heroPosition.desktop || 'center top',
          }}
        />
        <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.18),transparent_34%)]" />
      </>
    ) : (
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.14),transparent_40%)]" />
    )}
    <div className="relative z-20 mx-auto max-w-4xl text-center">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.26em] text-emerald-500 dark:text-emerald-300">{eyebrow}</p>}
      <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
        {title}
      </h1>
      {description && (
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
          {description}
        </p>
      )}
      {(primaryCta || secondaryCta) && (
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {primaryCta && <Button to={primaryCta.to} size="lg">{primaryCta.label}</Button>}
          {secondaryCta && <Button to={secondaryCta.to} variant="secondary" size="lg">{secondaryCta.label}</Button>}
        </div>
      )}
    </div>
  </section>
);

export default PageHeader;
