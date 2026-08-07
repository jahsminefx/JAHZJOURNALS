import React from 'react';
import { Brain, Flame, AlertTriangle, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';
import CTASection from '../components/CTASection';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';

const psychologyFeatures = [
  {
    title: 'Pre-Trade Emotion Tracking',
    description: 'Log your emotional state (Calm, Confident, FOMO, Anxious, Impulsive) before every trade execution to detect mindset flaws.'
  },
  {
    title: 'Revenge Trading Detection',
    description: 'Automated warnings when order submissions occur immediately after a losing trade, preventing emotional compounding.'
  },
  {
    title: 'Discipline Score Calculator',
    description: 'Track your exact percentage of rule adherence. Quantitative proof that disciplined execution yields long-term equity growth.'
  },
  {
    title: 'Mistake & Rule Violation Logs',
    description: 'Catalog specific execution errors—moving stop losses, sizing up, taking unplanned setups—to eliminate them permanently.'
  }
];

const TradingPsychology = () => (
  <div className="min-h-screen bg-background text-foreground">
    <SEO
      title="Trading Psychology Journal | Overcome Revenge Trading & FOMO"
      description="Master your trading mindset with JAHZJOURNALS. Track pre-trade emotions, eliminate revenge trading, and calculate your discipline score to protect your equity."
      keywords="Trading Psychology Journal, Overcoming Revenge Trading, Forex FOMO, Trading Discipline Score, Emotional Trade Logger"
      canonical="https://jahzjournal.com/trading-psychology"
    />
    <Navbar />

    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <Breadcrumbs customItems={[{ name: 'Home', path: '/' }, { name: 'Trading Psychology', path: '/trading-psychology' }]} />

      <PageHeader
        eyebrow="Trading Psychology & Mindset"
        title="80% of Trading Success is Controlled by Your Mindset."
        description="Stop letting emotions dictate your executions. Track pre-trade mindset, eliminate revenge trading, and raise your discipline score."
        primaryCta={{ label: 'Track Your Mindset Free', to: '/register' }}
        heroImage="/heroes/hero-propfirmtraders.png"
        heroAlt="Trader managing emotional trade logs"
      />

      {/* Deep Content Section for AI Search & Google indexing */}
      <section className="py-16 border-b border-gray-800">
        <SectionHeader 
          eyebrow="Psychological Safeguards"
          title="Turn Mindset Flaws into Measurable Data"
        />

        <div className="grid md:grid-cols-2 gap-8 mt-10">
          {psychologyFeatures.map((feat, idx) => (
            <div key={idx} className="p-6 bg-gray-850 border border-gray-750 rounded-2xl space-y-3 shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Brain size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">{feat.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{feat.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Search FAQ Block */}
      <section className="py-16">
        <SectionHeader eyebrow="Frequently Asked Questions" title="Trading Psychology FAQs" />
        <div className="max-w-4xl mx-auto mt-8 space-y-4 text-xs">
          <div className="p-5 bg-gray-850 border border-gray-750 rounded-2xl space-y-2">
            <h4 className="font-bold text-sm text-gray-200">How does JAHZJOURNALS help eliminate revenge trading?</h4>
            <p className="text-gray-400 leading-relaxed">
              JAHZJOURNALS monitors order execution timing relative to previous trade closures. If a new position is opened rapidly after a loss without proper checklist confirmation, the system flags a revenge trading alert.
            </p>
          </div>

          <div className="p-5 bg-gray-850 border border-gray-750 rounded-2xl space-y-2">
            <h4 className="font-bold text-sm text-gray-200">What is a Discipline Score?</h4>
            <p className="text-gray-400 leading-relaxed">
              Your Discipline Score measures the percentage of logged trades executed strictly according to your pre-defined trading plan rules.
            </p>
          </div>
        </div>
      </section>

      <CTASection title="Master your mind in the markets today." cta="Start Tracking Your Mindset Free" />
    </main>

    <Footer />
  </div>
);

export default TradingPsychology;
