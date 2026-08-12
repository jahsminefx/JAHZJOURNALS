import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';

const Legal = ({ type }) => {
  const privacySections = [
    {
      id: 'introduction',
      title: '1. Introduction',
      content: (
        <>
          <p className="mb-4">
            JAHZJOURNALS is a trading journal and analytics platform. This policy explains what information we process and how.
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Effective date:</strong> August 2026</li>
            <li><strong>Last updated:</strong> August 2026</li>
          </ul>
        </>
      )
    },
    {
      id: 'information-we-collect',
      title: '2. Information We Collect',
      content: (
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li><strong>Account information:</strong> name, email, password (hashed), country, timezone, trading experience, trading style</li>
          <li><strong>Trading journal data:</strong> trade entries (pair, direction, entry/exit prices, stop loss, take profit, P/L, lot size, session, grade, notes, emotions, timestamps)</li>
          <li><strong>Screenshots:</strong> trade chart screenshots uploaded to Cloudinary</li>
          <li><strong>AI interaction data:</strong> prompts and responses when using AI features (processed via OpenAI/OpenRouter)</li>
          <li><strong>Usage data:</strong> pages visited, feature interactions, timestamps (server logs)</li>
          <li><strong>Technical data:</strong> IP address (logged by server), browser type, device type (from HTTP headers)</li>
          <li><strong>Subscription data:</strong> plan type, subscription status, payment reference (processed via Paystack — JAHZJOURNALS does not store full payment card details)</li>
          <li><strong>Support/contact data:</strong> messages submitted through the contact form</li>
        </ul>
      )
    },
    {
      id: 'how-we-use',
      title: '3. How We Use Your Information',
      content: (
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Provide and maintain the trading journal platform</li>
          <li>Process trades, analytics, and AI-powered insights</li>
          <li>Manage your account and subscription</li>
          <li>Send transactional emails (via Brevo) for account verification, password resets, subscription notices</li>
          <li>Improve the platform and fix bugs</li>
          <li>Enforce terms and prevent abuse</li>
          <li>Display advertising on eligible public pages where permitted</li>
        </ul>
      )
    },
    {
      id: 'advertising',
      title: '4. Advertising and Third-Party Advertising Partners',
      content: (
        <>
          <p className="mb-4">
            JAHZJOURNALS may use third-party advertising services, including Google AdSense, to display advertisements on eligible public pages of the platform when advertising is enabled.
          </p>
          <p className="mb-4">
            Third-party vendors, including Google, may use cookies, device identifiers, web beacons, pixels, and similar technologies to serve advertisements, measure advertising performance, and, where permitted by applicable consent and legal frameworks, personalise advertisements based on users' prior visits to JAHZJOURNALS or other websites.
          </p>
          <p className="mb-4">
            Google's use of advertising cookies enables it and its partners to serve ads to users based on their visits to JAHZJOURNALS and/or other sites on the Internet.
          </p>
          <p className="mb-4">
            Advertising technologies may process information such as: IP address, browser type, device information, approximate location derived from IP address, pages visited on public sections of the site, interaction with advertisements, advertising identifiers, cookie identifiers, timestamps, and referral information.
          </p>
          <p className="mb-4 font-semibold text-emerald-400">
            JAHZJOURNALS does NOT share your private trading journal data — including trade history, strategies, journal notes, emotions, screenshots, AI conversations, account balances, or prop-firm information — with advertising providers.
          </p>
          <p className="mb-4">
            Advertising is displayed only on public marketing and content pages. Authenticated trading application pages (Dashboard, Trades, Analytics, AI, etc.) are not eligible for advertising.
          </p>
        </>
      )
    },
    {
      id: 'advertising-opt-out',
      title: '5. Personalised Advertising Opt-Out',
      content: (
        <>
          <p className="mb-4">Users can manage personalised advertising preferences through:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Google Ads Settings: <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">https://adssettings.google.com/</a></li>
            <li>Digital Advertising Alliance: <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">https://optout.aboutads.info/</a></li>
          </ul>
          <p className="mb-4">Users can also manage advertising preferences through the JAHZJOURNALS Privacy Settings.</p>
        </>
      )
    },
    {
      id: 'third-party-ads',
      title: '6. Third-Party Advertising Providers',
      content: (
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li><strong>Current advertising provider:</strong> Google AdSense (when enabled)</li>
          <li>Link to Google's Privacy & Terms: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">https://policies.google.com/privacy</a></li>
          <li>Additional advertising providers will be disclosed here if introduced.</li>
        </ul>
      )
    },
    {
      id: 'cookies-local-storage',
      title: '7. Cookies, Local Storage & Similar Technologies',
      content: (
        <>
          <p className="mb-4">JAHZJOURNALS uses the following technologies:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Essential cookies:</strong> Authentication session cookie (HTTP-only, secure) required for login/access</li>
            <li><strong>Local storage:</strong> UI preferences (theme, sidebar state, dismissed announcements), application settings, data synchronisation tokens. These are functional technologies required for the application to work properly.</li>
            <li><strong>Advertising cookies:</strong> When advertising is enabled and user has consented, third-party advertising providers may set cookies for ad delivery and measurement.</li>
          </ul>
          <p className="mb-4">
            Refer to our dedicated <Link to="/cookies" className="text-emerald-400 hover:text-emerald-300 underline">Cookie Policy</Link> for detailed information. JAHZJOURNALS does NOT use sessionStorage or IndexedDB.
          </p>
        </>
      )
    },
    {
      id: 'third-party-services',
      title: '8. Third-Party Services',
      content: (
        <>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Cloudinary</strong> — Cloud image hosting for trade screenshots. Privacy: <a href="https://cloudinary.com/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">https://cloudinary.com/privacy</a></li>
            <li><strong>Brevo</strong> — Transactional email delivery (verification, password reset, subscription notices). Privacy: <a href="https://www.brevo.com/legal/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">https://www.brevo.com/legal/privacypolicy/</a></li>
            <li><strong>Paystack</strong> — Payment processing for subscriptions. Processes payment card data directly — JAHZJOURNALS does not store card details. Privacy: <a href="https://paystack.com/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">https://paystack.com/privacy</a></li>
            <li><strong>OpenAI / OpenRouter</strong> — AI-powered trading analysis (trade reviews, coaching, pattern finding). Processes anonymised trade data only when explicitly triggered by the user. Privacy: <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">https://openai.com/privacy</a></li>
            <li><strong>Hosting infrastructure</strong> — Application hosted on dedicated server infrastructure. Server logs may contain IP addresses and request metadata.</li>
          </ul>
          <p className="mb-4 font-semibold text-emerald-400">JAHZJOURNALS does NOT share private trading data with advertising providers.</p>
        </>
      )
    },
    {
      id: 'data-retention',
      title: '9. Data Retention & User Rights',
      content: (
        <>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Account data is retained while the account is active</li>
            <li>Trade journal data is retained as long as the account exists</li>
            <li>Users can export all their data at any time via Settings &gt; Data &amp; Privacy &gt; Export</li>
            <li>Users can request account deletion via Settings &gt; Data &amp; Privacy &gt; Delete Account (requires password confirmation)</li>
            <li>When an account is deleted, associated trades, screenshots, AI history, settings, and account data are permanently removed</li>
            <li><strong>Your rights</strong> (where applicable under law): Access your data, Correct inaccurate data, Delete your data, Withdraw consent for non-essential processing, Object to processing, Data portability</li>
            <li>To exercise rights: use the Settings &gt; Data &amp; Privacy controls or contact support</li>
          </ul>
        </>
      )
    },
    {
      id: 'international',
      title: '10. International Users',
      content: (
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>JAHZJOURNALS operates internationally and may be accessed by users worldwide</li>
          <li><strong>EEA/UK/Switzerland:</strong> Where applicable privacy regulations require consent before non-essential technologies are activated, JAHZJOURNALS provides consent controls. Users may manage preferences through the cookie consent interface or Settings &gt; Data &amp; Privacy. Google AdSense requirements for the EEA/UK may require use of a Google-certified Consent Management Platform — this is configured externally.</li>
          <li><strong>United States:</strong> Where applicable US state privacy laws provide rights regarding personal information, JAHZJOURNALS supports opt-out of non-essential advertising and analytics technologies through the privacy settings. Users may exercise "Do Not Sell or Share" rights where applicable through Privacy Settings.</li>
          <li><strong>Nigeria and other regions:</strong> JAHZJOURNALS processes data in accordance with the Nigeria Data Protection Regulation (NDPR) where applicable. Users retain rights to access, correct, and delete their data.</li>
        </ul>
      )
    },
    {
      id: 'do-not-sell',
      title: '11. Do Not Sell or Share',
      content: (
        <p className="mb-4">
          JAHZJOURNALS does not sell your personal information in the traditional sense. When advertising is enabled, the use of advertising cookies by third-party advertising providers may constitute "sharing" under certain US state privacy laws. You can opt out of this sharing through our Privacy Settings or by using the "Reject Non-Essential" option in the cookie consent interface.
        </p>
      )
    },
    {
      id: 'childrens-privacy',
      title: "12. Children's Privacy",
      content: (
        <p className="mb-4">
          JAHZJOURNALS is designed for adult traders. We do not knowingly collect information from anyone under 18.
        </p>
      )
    },
    {
      id: 'changes',
      title: '13. Changes to This Policy',
      content: (
        <p className="mb-4">
          We may update this policy. Material changes will be communicated. Continued use after changes constitutes acceptance. Consent may be re-requested when the privacy policy materially changes.
        </p>
      )
    },
    {
      id: 'contact',
      title: '14. Contact',
      content: (
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>For privacy inquiries: <a href="mailto:support@jahzjournals.com" className="text-emerald-400 hover:text-emerald-300 underline">support@jahzjournals.com</a></li>
          <li>Or use the <Link to="/contact" className="text-emerald-400 hover:text-emerald-300 underline">Contact</Link> form.</li>
        </ul>
      )
    }
  ];

  const termsSections = [
    {
      id: 'agreement',
      title: '1. Agreement to Terms',
      content: <p className="mb-4">By using JAHZJOURNALS, you agree to these terms.</p>
    },
    {
      id: 'platform-description',
      title: '2. Platform Description',
      content: <p className="mb-4">Trading journal, analytics, AI insights, prop-firm tracking. Educational/analytical tools, NOT financial advice.</p>
    },
    {
      id: 'user-accounts',
      title: '3. User Accounts',
      content: <p className="mb-4">Registration, accuracy of information, security of credentials, one account per person.</p>
    },
    {
      id: 'acceptable-use',
      title: '4. Acceptable Use',
      content: <p className="mb-4">Do not: reverse engineer, scrape, abuse APIs, share credentials, upload illegal content, modify endpoints.</p>
    },
    {
      id: 'ai-features',
      title: '5. AI Features',
      content: <p className="mb-4">AI analysis is for educational/analytical purposes only. Not financial advice. AI accuracy is not guaranteed.</p>
    },
    {
      id: 'intellectual-property',
      title: '6. Intellectual Property',
      content: <p className="mb-4">JAHZJOURNALS platform, design, and code are proprietary. Your trading data remains yours.</p>
    },
    {
      id: 'subscription-payments',
      title: '7. Subscription & Payments',
      content: <p className="mb-4">Subscription tiers, payment via Paystack, cancellation, refund policy.</p>
    },
    {
      id: 'advertising',
      title: '8. Advertising',
      content: <p className="mb-4">JAHZJOURNALS may display advertising on public pages. Advertising does not constitute endorsement.</p>
    },
    {
      id: 'liability',
      title: '9. Limitation of Liability',
      content: <p className="mb-4">Not responsible for trading losses. Platform is for journaling/analysis, not trade execution.</p>
    },
    {
      id: 'termination',
      title: '10. Termination',
      content: <p className="mb-4">We may suspend/terminate accounts for violations.</p>
    },
    {
      id: 'changes',
      title: '11. Changes to Terms',
      content: <p className="mb-4">We may update. Continued use = acceptance.</p>
    },
    {
      id: 'contact',
      title: '12. Contact',
      content: <p className="mb-4">Contact us at <a href="mailto:support@jahzjournals.com" className="text-emerald-400 hover:text-emerald-300 underline">support@jahzjournals.com</a></p>
    }
  ];

  const cookieSections = [
    {
      id: 'what-are-cookies',
      title: '1. What Are Cookies',
      content: (
        <p className="mb-4">
          Cookies are small text files stored on your device. We also use localStorage and similar technologies to remember your preferences and maintain your session securely.
        </p>
      )
    },
    {
      id: 'technologies-used',
      title: '2. Technologies Used by JAHZJOURNALS',
      content: (
        <>
          <p className="mb-4 font-semibold">Essential (Always Active):</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><code>jwt</code> — HTTP-only authentication cookie, session management, expires per JWT configuration (default 7 days)</li>
          </ul>
          
          <p className="mb-4 font-semibold">Functional / Preferences (localStorage):</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><code>jahzjournals-theme</code> — UI theme preference (light/dark/system)</li>
            <li><code>jahzjournals.settings.v1</code> — Application settings cache</li>
            <li><code>jahzjournal-sidebar-collapsed</code> — Sidebar UI state</li>
            <li><code>dismissed_announcements</code> — Dismissed announcement IDs</li>
            <li><code>foundingTraderWelcomeShown</code> — Welcome modal shown flag</li>
            <li><strong>Widget position data</strong> — Floating widget coordinates</li>
            <li><code>jahzjournal:data-version</code> — Data synchronisation timestamp</li>
          </ul>

          <p className="mb-4 font-semibold">Consent Management:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><code>jahzjournals-consent</code> — Stores consent preferences (categories, version, timestamp)</li>
          </ul>

          <p className="mb-4 font-semibold">Analytics:</p>
          <p className="mb-4">Not currently active. When analytics providers are integrated, they will be documented here.</p>

          <p className="mb-4 font-semibold">Advertising:</p>
          <p className="mb-4">When Google AdSense is enabled, Google and its advertising partners may set cookies for ad delivery, measurement, and personalisation. Refer to Google's cookie documentation.</p>
        </>
      )
    },
    {
      id: 'how-to-manage',
      title: '3. How to Manage',
      content: (
        <>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Through JAHZJOURNALS Privacy Settings</li>
            <li>Through the cookie consent banner</li>
            <li>Through browser settings</li>
          </ul>
          <p className="mb-4 text-emerald-400">Note: Blocking essential cookies will prevent login.</p>
        </>
      )
    },
    {
      id: 'third-party-cookies',
      title: '4. Third-Party Cookies',
      content: <p className="mb-4">Advertising cookies are set by third-party advertising providers, not by JAHZJOURNALS directly.</p>
    },
    {
      id: 'changes',
      title: '5. Changes',
      content: <p className="mb-4">This policy may be updated.</p>
    },
    {
      id: 'contact',
      title: '6. Contact',
      content: <p className="mb-4">Contact us at <a href="mailto:support@jahzjournals.com" className="text-emerald-400 hover:text-emerald-300 underline">support@jahzjournals.com</a></p>
    }
  ];

  const disclaimerSections = [
    {
      id: 'general-risk',
      title: '1. General Risk Warning',
      content: <p className="mb-4">Trading carries high risk. Past performance does not guarantee future results.</p>
    },
    {
      id: 'platform-purpose',
      title: '2. Platform Purpose',
      content: <p className="mb-4">JAHZJOURNALS is a journaling and analytics tool, not a broker or financial advisor.</p>
    },
    {
      id: 'ai-disclaimer',
      title: '3. AI Disclaimer',
      content: <p className="mb-4">AI insights are analytical, not recommendations. Do not trade based solely on AI output.</p>
    },
    {
      id: 'no-guarantee',
      title: '4. No Guarantee',
      content: <p className="mb-4">Statistical metrics (expectancy, win rate, R-multiple) describe past performance only.</p>
    },
    {
      id: 'your-responsibility',
      title: '5. Your Responsibility',
      content: <p className="mb-4">Trading decisions are entirely your own.</p>
    }
  ];

  const contentMap = {
    privacy: { title: 'Privacy Policy', sections: privacySections, date: 'August 2026' },
    terms: { title: 'Terms of Service', sections: termsSections },
    cookies: { title: 'Cookie Policy', sections: cookieSections, date: 'August 2026' },
    disclaimer: { title: 'Risk Disclaimer', sections: disclaimerSections }
  };

  const { title, sections, date } = contentMap[type] || contentMap.terms;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <SEO title={title} />
      <Navbar />
      <main className="max-w-4xl mx-auto py-16 px-6 lg:text-left">
        <Breadcrumbs />
        
        <h1 className="text-3xl font-bold text-foreground mb-8">{title}</h1>
        
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-xl">
          {date && (
            <p className="text-muted mb-8 italic">Last updated: {date}</p>
          )}

          {/* Table of Contents */}
          <div className="mb-12 bg-background/50 p-6 rounded-xl border border-border/50">
            <h2 className="text-lg font-bold text-foreground mb-4">Table of Contents</h2>
            <ul className="space-y-2">
              {sections.map(section => (
                <li key={`toc-${section.id}`}>
                  <a href={`#${section.id}`} className="text-emerald-400 hover:text-emerald-300 underline">
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Sections Content */}
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-xl font-bold text-foreground mb-4">{section.title}</h2>
                <div className="text-muted leading-relaxed">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Legal;
