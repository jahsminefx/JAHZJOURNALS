import React, { useState, useId } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQItem = ({ question, answer, defaultOpen = false, id }) => {
  const [open, setOpen] = useState(defaultOpen);
  const reactId = useId();
  const baseId = id || reactId;
  const sanitizedId = String(baseId).replace(/[^a-zA-Z0-9_-]/g, '');
  const buttonId = `faq-q-${sanitizedId}`;
  const panelId = `faq-a-${sanitizedId}`;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm transition-colors duration-200 hover:border-emerald-500/30">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
      >
        <span className="font-semibold text-foreground text-sm sm:text-base">{question}</span>
        <ChevronDown
          size={20}
          aria-hidden="true"
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="faq-answer-enter border-t border-border px-5 pb-5 pt-4 text-sm leading-6 text-muted"
        >
          {answer}
        </div>
      )}
    </div>
  );
};

export default FAQItem;
