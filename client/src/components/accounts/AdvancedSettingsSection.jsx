import React from 'react';

const AdvancedSettingsSection = ({ title, description, children }) => (
  <section className="rounded-lg border border-border bg-surface-muted p-5">
    <div className="mb-5">
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
    </div>
    {children}
  </section>
);

export default AdvancedSettingsSection;
