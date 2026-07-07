import React from 'react';
import { CheckCircle2, MessageSquareWarning } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';
import MentorMockup from '../components/MentorMockup';
import CTASection from '../components/CTASection';

const problems = ['Students do not journal properly', 'Screenshots are scattered', 'Hard to track progress', 'Hard to know who is improving', 'Feedback is not organized'];
const solutions = ['Student journals', 'Trade screenshots', 'Mentor comments', 'Discipline scores', 'Group analytics', 'Weekly progress reviews'];

const Mentors = () => (
  <div className="min-h-screen bg-gray-950 text-gray-100">
    <Navbar />
    <main>
      <PageHeader
        eyebrow="Mentors and academies"
        title="Manage Student Journals Without Chasing Screenshots on WhatsApp."
        description="Give students a structured place to log trades, upload screenshots, and receive organized feedback."
        primaryCta={{ label: 'Create a Mentor Workspace', to: '/register' }}
        heroImage="/heroes/hero-mentors.png"
        heroAlt="Mentor reviewing student trading journals"
        heroPosition={{ mobile: '72% top', tablet: '64% top', desktop: 'center top' }}
      />
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div>
            <SectionHeader align="left" eyebrow="Mentor problems" title="Coaching gets harder when evidence is scattered." />
            <div className="mt-8 space-y-3">
              {problems.map((problem) => (
                <div key={problem} className="flex gap-3 rounded-xl border border-red-400/15 bg-red-400/[0.04] p-4 text-sm text-gray-200">
                  <MessageSquareWarning size={18} className="text-red-300" />
                  {problem}
                </div>
              ))}
            </div>
          </div>
          <MentorMockup />
        </div>
      </section>
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Solution" title="Review student process from one workspace." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solutions.map((solution) => (
              <div key={solution} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <CheckCircle2 size={18} className="text-emerald-300" />
                <span className="text-sm text-gray-300">{solution}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CTASection title="Create a cleaner review culture for your students." cta="Create a Mentor Workspace" />
    </main>
    <Footer />
  </div>
);

export default Mentors;
