import React from 'react';
import { Target, ShieldAlert, BarChart3, Calculator, CheckCircle2, ArrowRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';
import CTASection from '../components/CTASection';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';

const riskFeatures = [
  {
    title: 'Position Size & Lot Calculator',
    description: 'Calculate exact MT4/MT5 position sizes based on account equity, stop loss pips, and risk percentage.'
  },
  {
    title: 'Daily & Overall Drawdown Safeguards',
    description: 'Track maximum allowed daily drawdown (e.g. 5%) to protect prop firm challenges from breaching.'
  },
  {
    title: 'Asymmetric Risk-to-Reward Analytics',
    description: 'Analyze your realized R:R ratios vs planned initial targets to ensure positive expectancy.'
  },
  {
    title: 'Max Consecutive Loss Protection',
    description: 'Identify drawdown clusters and receive cooling-off recommendations after multiple consecutive losses.'
  }
];

const RiskManagementPage = () => (
  <div className="min-h-screen bg-background text-foreground">
    <SEO
      title="Risk Management for Forex & Prop Firm Traders | JAHZJOURNALS"
      description="Protect your trading capital with JAHZJOURNALS risk management software. Built-in lot size calculators, prop firm drawdown monitors, and risk-to-reward analytics."
      keywords="Forex Risk Management, Prop Firm Drawdown Limits, Position Size Calculator, Risk to Reward Ratio Forex, Capital Protection"
      canonical="https://jahzjournal.com/risk-management"
    />
    <Navbar />

    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <Breadcrumbs customItems={[{ name: 'Home', path: '/' }, { name: 'Risk Management', path: '/risk-management' }]} />

      <PageHeader
        eyebrow="Risk & Equity Safeguards"
        title="Capital Preservation is Job #1 for Every Serious Trader."
        description="Never breach a daily drawdown limit again. Calculate exact position sizes and protect your trading capital."
        primaryCta={{ label: 'Use Risk Calculator Free', to: '/register' }}
        heroImage="/heroes/hero-pricing.png"
        heroAlt="Forex risk management dashboard analytics"
      />

      <section className="py-16 border-b border-gray-800">
        <SectionHeader 
          eyebrow="Core Features"
          title="Institutional Risk Tools Built for Retail Traders"
        />

        <div className="grid md:grid-cols-2 gap-8 mt-10">
          {riskFeatures.map((feat, idx) => (
            <div key={idx} className="p-6 bg-gray-850 border border-gray-750 rounded-2xl space-y-3 shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Target size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">{feat.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{feat.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <SectionHeader eyebrow="Risk FAQ" title="Risk Management Questions" />
        <div className="max-w-4xl mx-auto mt-8 space-y-4 text-xs">
          <div className="p-5 bg-gray-850 border border-gray-750 rounded-2xl space-y-2">
            <h4 className="font-bold text-sm text-gray-200">How does the position size calculator work?</h4>
            <p className="text-gray-400 leading-relaxed">
              Input your account balance, risk percentage (e.g. 1%), and stop loss distance in pips. The calculator instantly determines the exact lot size for EURUSD, GBPUSD, XAUUSD, or Indices.
            </p>
          </div>
        </div>
      </section>

      <CTASection title="Protect your trading capital with automated risk safeguards." cta="Start Managing Risk Free" />
    </main>

    <Footer />
  </div>
);

export default RiskManagementPage;
