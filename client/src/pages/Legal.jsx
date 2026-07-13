import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Legal = ({ type }) => {
  const content = {
    terms: {
      title: "Terms of Service",
      body: "By operating within JahzJournals you agree to our structural ecosystem boundaries. The AI Insights and trading analytics are strictly meant for educational performance tracking. They do not constitute financial advice. Modifying or subverting our endpoints is prohibited."
    },
    privacy: {
      title: "Privacy Policy",
      body: "Your trade data is sovereign. We do not distribute your API keys, journal reflections, or screenshots to 3rd party advertising algorithms. OpenAI only processes anonymized trade vectors when explicitly triggered via the AI Mentor UI."
    },
    disclaimer: {
      title: "Risk Disclaimer",
      body: "Trading foreign exchange on margin carries a high level of risk. Past performance does not guarantee future outcomes. JahzJournals calculates statistical expectancy, but cannot insulate you from market volatility conditions."
    }
  };

  const { title, body } = content[type] || content.terms;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <main className="max-w-4xl mx-auto py-24 px-6 text-center lg:text-left">
        <h1 className="text-3xl font-bold text-foreground mb-8">{title}</h1>
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-xl">
          <p className="text-muted leading-relaxed text-lg">
            {body}
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Legal;
