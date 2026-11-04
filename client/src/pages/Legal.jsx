import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import { ShieldCheck, AlertTriangle, FileText, Lock, RefreshCw, CheckCircle2 } from 'lucide-react';

const Legal = ({ type }) => {
  // ==========================================
  // 1. TERMS OF SERVICE
  // ==========================================
  const termsSections = [
    {
      id: 'agreement-and-preamble',
      title: '1. Agreement to Terms & Preamble',
      content: (
        <>
          <p className="mb-4">
            These Terms of Service ("Terms") constitute a legally binding agreement between you ("Trader", "Mentor", "User", or "You") and <strong>JAHZJOURNALS</strong> ("Platform", "Company", "We", "Us", or "Our"). By accessing, browsing, registering for, or using the JAHZJOURNALS platform, application, application programming interfaces (APIs), or associated services (collectively, the "Service"), you acknowledge that you have read, understood, and agree to be bound by these Terms, our Privacy Policy, our Risk Disclosure, and our Refund Policy.
          </p>
          <p className="mb-4">
            If you do not agree with any part of these Terms, you must immediately discontinue use of the Service. These Terms apply to all visitors, registered traders, coaching mentors, student cohort members, and administrative users across all web, desktop, and progressive web application (PWA) client interfaces.
          </p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-xs">
            <li><strong>Effective Date:</strong> November 3, 2026</li>
            <li><strong>Governing Jurisdiction:</strong> Federal Republic of Nigeria (with international electronic commerce provisions)</li>
            <li><strong>Regulatory Classification:</strong> Self-Directed Trading Journal & Analytical Technology Provider</li>
          </ul>
        </>
      ),
    },
    {
      id: 'eligibility-and-accounts',
      title: '2. Eligibility, Account Registration & Security',
      content: (
        <>
          <p className="mb-4">
            To register for an account and access the Service, you represent and warrant that:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>You are at least <strong>18 years of age</strong> (or the age of legal majority in your country of residence) with full legal capacity to enter into a binding contract;</li>
            <li>All registration details, including your full legal name, valid email address, billing country, and profile information, are true, accurate, current, and complete;</li>
            <li>You are registering for your own personal or authorized commercial use, and you will not operate multiple accounts to circumvent plan quotas or abuse free trial allocations;</li>
            <li>You are not located in, a national of, or resident of any jurisdiction subject to international trade sanctions or embargoes.</li>
          </ul>
          <p className="mb-4">
            <strong>Account Credentials & Safeguarding:</strong> You are solely responsible for maintaining the confidentiality of your login credentials (email and password hash) and for any and all activity that occurs under your account. You agree to notify JAHZJOURNALS immediately at <a href="mailto:jahzjournals@gmail.com" className="text-emerald-400 underline">jahzjournals@gmail.com</a> if you suspect any unauthorized access, breach, or compromise of your account security. JAHZJOURNALS will not be liable for any loss or damage arising from your failure to safeguard your credentials.
          </p>
        </>
      ),
    },
    {
      id: 'strict-non-brokerage-status',
      title: '3. Strict Non-Brokerage & Non-Financial Advisor Declaration',
      content: (
        <>
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 mb-4 text-xs text-amber-200 leading-relaxed font-semibold">
            IMPORTANT STATUTORY NOTICE: JAHZJOURNALS IS NOT A BROKER, NOT A DEALER, NOT A COMMODITY TRADING ADVISOR (CTA), NOT AN ASSET MANAGER, AND NOT A LICENSED FINANCIAL ADVISOR.
          </div>
          <p className="mb-4">
            JAHZJOURNALS is strictly an independent <strong>record-keeping, trading journal, performance analytics, and psychological habit-formation software platform</strong>. Under no circumstances does JAHZJOURNALS:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Solicit, receive, hold, transmit, or custody client trading capital, deposits, or margin funds;</li>
            <li>Execute, route, fill, or manage live financial trades, foreign exchange orders, or contracts for difference (CFDs);</li>
            <li>Provide personalized investment recommendations, portfolio management, or financial planning;</li>
            <li>Guarantee trading profits, account growth, or the successful passing of proprietary trading firm ("prop firm") evaluation challenges.</li>
          </ul>
          <p className="mb-4">
            All trade execution takes place independently between you and your chosen third-party brokerages or prop-firm evaluation partners. Any statistical metrics (such as win rates, expectancy, average R-multiples, profit factors, or drawdown monitors) reflect past historical execution recorded in your journal and do not predict future performance.
          </p>
        </>
      ),
    },
    {
      id: 'subscriptions-and-billing',
      title: '4. Subscription Plans, Billing & Paystack Processing',
      content: (
        <>
          <p className="mb-4">
            JAHZJOURNALS offers tiered subscription plans (Free, Starter, Pro, Pro Sync, and Mentor tiers: Private Cohort, Growth Community, Mega Academy) designed to accommodate individual retail traders and community mentors.
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Billing Currency & Pricing:</strong> Subscriptions in Nigeria and supported African jurisdictions are billed in Nigerian Naira (NGN) inclusive of applicable payment processing charges. International reference pricing is denominated in United States Dollars (USD).</li>
            <li><strong>Payment Gateway:</strong> All payments are securely processed through our PCI-DSS Level 1 certified payment infrastructure partner, <strong>Paystack Payments Limited</strong>. JAHZJOURNALS never stores, processes, or captures your complete debit/credit card numbers or CVV codes on our servers.</li>
            <li><strong>Automatic Recurring Billing:</strong> By subscribing to a paid monthly or annual tier, you authorize Paystack to automatically charge your designated payment instrument at the beginning of each recurring billing cycle until you cancel your subscription.</li>
            <li><strong>Upgrades & Proration:</strong> Upgrades between plan tiers take effect immediately upon successful charge. If an official promotional discount or promotional code is redeemed, the discount percentage applies strictly according to that promotion's terms.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'trials-and-refunds',
      title: '5. 14-Day Free Trials, Cancellation & Refund Policy',
      content: (
        <>
          <p className="mb-4">
            <strong>14-Day Free Trial Terms:</strong> Eligible plans (such as the Private Cohort tier) may offer a 14-day complimentary trial with a 12-hour grace buffer. Free trials allow you to evaluate platform capabilities without upfront commitment. Free trials are strictly limited to one trial per user account and identity. JAHZJOURNALS reserves the right to prevent multi-account trial abuse.
          </p>
          <p className="mb-4">
            <strong>Self-Service Cancellation:</strong> You can cancel your subscription at any time without fees or penalties directly through your account dashboard (<strong>Settings &rarr; Subscription & Plan</strong>). Upon cancellation:
          </p>
          <ul className="list-disc pl-6 space-y-1 mb-4">
            <li>Your automatic renewal authorization will be revoked immediately;</li>
            <li>You will retain full access to all features of your paid tier until the expiration of your current paid billing period;</li>
            <li>Upon period expiration, your account will smoothly transition to the Free tier without deleting your historical trade records.</li>
          </ul>
          <p className="mb-4">
            <strong>Refund Policy on Digital SaaS Services:</strong> Due to the immediate provisioning and digital nature of JAHZJOURNALS software and cloud computing services, payments are generally non-refundable once a billing cycle has commenced. Exceptions are granted in cases of:
          </p>
          <ul className="list-disc pl-6 space-y-1 mb-4">
            <li>Verified duplicate billing caused by technical payment gateway anomalies;</li>
            <li>Accidental renewal where an explicit refund request is submitted within <strong>48 hours</strong> of billing, provided zero new trades, screenshots, or AI reviews have been generated during that renewed period.</li>
          </ul>
          <p className="mb-4">
            To request billing assistance or refunds, contact <a href="mailto:jahzjournals@gmail.com" className="text-emerald-400 underline">jahzjournals@gmail.com</a> with your Paystack payment reference.
          </p>
        </>
      ),
    },
    {
      id: 'mentor-marketplace-and-cohorts',
      title: '6. Mentor Marketplace & Student Cohort Guidelines',
      content: (
        <>
          <p className="mb-4">
            JAHZJOURNALS provides coaching infrastructure allowing mentors and academy coaches to host student cohorts, attach strategy risk violation rules, review student trades, and issue educational grades.
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Independent Educator Status:</strong> Mentors operate as independent third-party educational creators and coaches. Mentors are NOT employees, agents, or registered partners of JAHZJOURNALS. JAHZJOURNALS does not audit, endorse, or verify mentor claims, trading track records, or external signals.</li>
            <li><strong>Prohibition of Unregulated Capital Pooling:</strong> Mentors are strictly prohibited from using JAHZJOURNALS infrastructure to solicit, pool, or manage third-party student capital for collective investment schemes (CIS), account management, or illegal money market operations under Central Bank of Nigeria (CBN) and SEC Nigeria directives. Violation results in immediate account termination.</li>
            <li><strong>Subaccount Payouts & 1.5% Platform Fee:</strong> When mentors offer paid student cohort checkouts through JAHZJOURNALS, payments are routed through Paystack Subaccounts. JAHZJOURNALS deducts a modest <strong>1.5% platform facilitation fee</strong> to cover hosting, cloud computing, and support overhead, with the net balance settled directly to the mentor's verified Nigerian commercial bank account.</li>
            <li><strong>Student Disputes:</strong> Any educational, content, or mentoring disputes between students and mentors must be resolved directly between the parties. JAHZJOURNALS provides transactional mediation records where applicable.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'ai-and-vision-services',
      title: '7. JAHZ AI, Vision Capture & Synthetic Data Disclaimers',
      content: (
        <>
          <p className="mb-4">
            JAHZJOURNALS features artificial intelligence tools (including JAHZ AI screenshot vision extraction, AI trade reviews, pattern recognition, and coaching summaries) powered by enterprise inference models through OpenAI and OpenRouter.
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>AI-generated trade reviews, psychology tagging, and coaching notes are for <strong>educational self-reflection and analytical habit formation only</strong>. They do not constitute guaranteed trading advice or buy/sell signals.</li>
            <li>While screenshot vision extraction uses state-of-the-art multimodal parsing, OCR extraction from complex chart candles or mobile broker screens may occasionally misread numbers. You are solely responsible for reviewing and verifying the numerical accuracy of all extracted trade parameters before logging.</li>
            <li><strong>Privacy Guarantee:</strong> Customer trade journals, proprietary strategies, and personal notes are never used by JAHZJOURNALS or third-party inference providers to train generalized public foundational AI models.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'broker-sync-and-metatrader',
      title: '8. MetaTrader 4/5 Integration & Broker Cloud Sync',
      content: (
        <>
          <p className="mb-4">
            JAHZJOURNALS supports automated trade ingestion from supported MetaTrader 4 (MT4) and MetaTrader 5 (MT5) broker accounts via cloud synchronization infrastructure (including MetaApi).
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Read-Only Access:</strong> Cloud sync operates strictly with read-only investor clearance to inspect historical closed tickets, executions, and balance curves. JAHZJOURNALS never requests, stores, or utilizes master trading passwords or order execution capabilities.</li>
            <li><strong>External Broker Latency:</strong> JAHZJOURNALS is not liable for delayed trade ingestion, missing history tickets, disconnection errors, or server downtime resulting from external broker maintenance, network outages, or proprietary broker bridge configurations.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'intellectual-property-and-data',
      title: '9. Trader Data Ownership & Intellectual Property',
      content: (
        <>
          <p className="mb-4">
            <strong>Your Data Remains Yours:</strong> You retain 100% full legal ownership, copyright, and intellectual property rights over your personal trading records, trade notes, screenshots, custom strategies, rule configurations, and emotions logged on the platform.
          </p>
          <p className="mb-4">
            <strong>Platform License:</strong> You grant JAHZJOURNALS a limited, worldwide, non-exclusive, royalty-free license solely to host, store, cache, compute, and display your data for the purpose of operating the Service and delivering your analytics.
          </p>
          <p className="mb-4">
            <strong>JAHZJOURNALS Property:</strong> The JAHZJOURNALS name, brand lockups, user interface designs, custom icons, algorithms, AI prompting matrices, databases, and source code are the exclusive proprietary property of JAHZJOURNALS and are protected under Nigerian and international copyright, trademark, and intellectual property laws.
          </p>
        </>
      ),
    },
    {
      id: 'acceptable-use',
      title: '10. Acceptable Use Policy & System Prohibitions',
      content: (
        <>
          <p className="mb-4">You expressly agree that you will NOT:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Reverse-engineer, decompile, disassemble, or attempt to derive the source code of any portion of the platform;</li>
            <li>Use automated scrapers, spiders, robots, or crawling software to extract data from public or authenticated pages;</li>
            <li>Attempt to probe, scan, test the vulnerability of, or breach any security, authentication, or entitlement gating measure;</li>
            <li>Transmit malicious code, viruses, trojans, worms, or disruptive scripts through file uploads or support chats;</li>
            <li>Impersonate any individual, staff member, or entity, or misrepresent your affiliation with any brokerage or firm;</li>
            <li>Use the platform for any unlawful purpose, fraud, money laundering, or to violate financial market regulations.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'limitation-of-liability',
      title: '11. Limitation of Liability & Indemnification',
      content: (
        <>
          <p className="mb-4">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL JAHZJOURNALS, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION:
          </p>
          <ul className="list-disc pl-6 space-y-1 mb-4">
            <li>Any market losses, trading drawdowns, lost capital, margin calls, or liquidation events;</li>
            <li>Any failure to pass, suspension from, or breach of proprietary trading firm ("prop firm") evaluation rules;</li>
            <li>Any loss of data, profits, goodwill, business opportunities, or revenue;</li>
            <li>Any unauthorized access to, alteration of, or downtime of server and cloud infrastructure.</li>
          </ul>
          <p className="mb-4">
            You agree to defend, indemnify, and hold harmless JAHZJOURNALS and its affiliates from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with your use of the Service or your breach of these Terms.
          </p>
        </>
      ),
    },
    {
      id: 'governing-law-and-disputes',
      title: '12. Governing Law & Dispute Resolution',
      content: (
        <>
          <p className="mb-4">
            These Terms and any dispute or claim arising out of or in connection with them shall be governed by and construed in accordance with the substantive laws of the <strong>Federal Republic of Nigeria</strong>, without giving effect to any principles of conflicts of law.
          </p>
          <p className="mb-4">
            <strong>Mandatory 30-Day Informal Resolution:</strong> Before initiating any formal legal or arbitration proceeding, you and JAHZJOURNALS agree to attempt in good faith to resolve any dispute, claim, or controversy informally for a period of at least thirty (30) days by submitting written notice to <a href="mailto:jahzjournals@gmail.com" className="text-emerald-400 underline">jahzjournals@gmail.com</a>.
          </p>
          <p className="mb-4">
            If informal negotiation fails, the dispute shall be resolved through binding arbitration in accordance with the Arbitration and Mediation Act 2023 of Nigeria, with the venue situated in Lagos State, Nigeria.
          </p>
        </>
      ),
    },
    {
      id: 'contact-and-modifications',
      title: '13. Changes to Terms & Contact Details',
      content: (
        <>
          <p className="mb-4">
            We reserve the right to revise or amend these Terms at any time to reflect software upgrades, regulatory shifts, or legal requirements. When revisions are made, the "Last Updated" date at the top will be updated. Your continued use of the platform after revised Terms become effective constitutes your acceptance of the updated terms.
          </p>
          <p className="mb-4">
            For questions, legal notices, or inquiries regarding these Terms:
          </p>
          <ul className="list-disc pl-6 space-y-1 mb-4">
            <li><strong>Email:</strong> <a href="mailto:jahzjournals@gmail.com" className="text-emerald-400 underline">jahzjournals@gmail.com</a></li>
            <li><strong>Customer Support Console:</strong> In-app via <Link to="/support" className="text-emerald-400 underline">Support Desk</Link></li>
            <li><strong>Official Website:</strong> <a href="https://jahzjournals.com" className="text-emerald-400 underline">https://jahzjournals.com</a></li>
          </ul>
        </>
      ),
    },
  ];

  // ==========================================
  // 2. RISK DISCLAIMER & FINANCIAL DISCLOSURES
  // ==========================================
  const disclaimerSections = [
    {
      id: 'statutory-risk-warning',
      title: '1. Statutory High-Risk Investment Warning',
      content: (
        <>
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 mb-4 text-xs text-red-300 font-semibold leading-relaxed">
            CRITICAL WARNING: TRADING FOREIGN EXCHANGE (FOREX), CONTRACTS FOR DIFFERENCE (CFDs), COMMODITIES, CRYPTO-ASSETS, AND FINANCIAL DERIVATIVES CARRIES A HIGH LEVEL OF RISK TO YOUR CAPITAL AND IS NOT SUITABLE FOR ALL INVESTORS.
          </div>
          <p className="mb-4">
            Financial leverage amplifies both potential profits and potential losses. It is possible to sustain a total loss of initial margin deposits or incurred balances rapidly. A substantial percentage (often between 70% and 85%) of retail investor accounts lose money when trading CFDs and leveraged financial products.
          </p>
          <p className="mb-4">
            You should never trade or invest money that you cannot afford to lose completely. Before deciding to trade leveraged foreign exchange or derivatives, you must carefully evaluate your trading objectives, experience level, risk tolerance, and personal financial situation.
          </p>
        </>
      ),
    },
    {
      id: 'not-financial-advice',
      title: '2. Non-Advisory & Software Purpose Only',
      content: (
        <>
          <p className="mb-4">
            JAHZJOURNALS operates exclusively as a financial software provider offering self-directed trading journaling, execution logs, habit tracking, and statistical analytics.
          </p>
          <p className="mb-4 font-semibold text-emerald-400">
            NOTHING CONTAINED ON JAHZJOURNALS CONSTITUTES INVESTMENT, FINANCIAL, LEGAL, TAX, OR REGULATORY ADVICE.
          </p>
          <p className="mb-4">
            No communication, blog article, performance metric, expectancy chart, or AI coaching prompt produced by the platform should be construed as an endorsement, recommendation, or solicitation to buy, sell, or hold any currency pair, security, or financial instrument. JAHZJOURNALS is not a registered financial advisor with the Securities and Exchange Commission of Nigeria (SEC Nigeria), the US Commodity Futures Trading Commission (CFTC), the US SEC, or the UK Financial Conduct Authority (FCA).
          </p>
        </>
      ),
    },
    {
      id: 'hypothetical-past-performance',
      title: '3. Past Performance & Hypothetical Metric Disclaimers',
      content: (
        <>
          <p className="mb-4">
            PAST PERFORMANCE IS NOT INDICATIVE OF FUTURE RESULTS. Any statistical metrics presented within the software—including Win Rate (%), Profit Factor, Expectancy ($E$), Sharpe Ratio, Drawdown Curves, and R-Multiple calculations—describe historical journal logs and past trade entries.
          </p>
          <p className="mb-4">
            Market liquidity conditions, slippage, macroeconomic policy announcements (such as NFP, CPI, and interest rate rate decisions), spread widening during rollover, and execution delays mean that historical performance patterns will not consistently repeat. JAHZJOURNALS makes no representation or warranty that any journaled strategy will achieve profits or avoid losses.
          </p>
        </>
      ),
    },
    {
      id: 'prop-firm-challenges',
      title: '4. Prop-Firm Challenges & Evaluation Account Disclaimers',
      content: (
        <>
          <p className="mb-4">
            JAHZJOURNALS provides simulated drawdown tracking, daily loss limit alerts, and prop-firm challenge calculators to help traders monitor discipline during funded evaluations (e.g., FTMO, Apex, FundedNext, etc.).
          </p>
          <p className="mb-4">
            However, all official evaluation rules, trailing drawdowns, balance-versus-equity thresholds, and challenge outcomes are strictly governed by your independent agreement with your proprietary firm. JAHZJOURNALS accepts zero responsibility or liability for failed challenges, breached rules, disqualified accounts, or lost evaluation fees.
          </p>
        </>
      ),
    },
    {
      id: 'trader-sole-responsibility',
      title: '5. Independent Trader Responsibility',
      content: (
        <>
          <p className="mb-4">
            You acknowledge and agree that all decisions to enter, modify, trail, or exit trades are made independently and solely by you. JAHZJOURNALS disclaims any liability for any financial loss, emotional distress, or damage caused directly or indirectly by reliance on the software.
          </p>
        </>
      ),
    },
  ];

  // ==========================================
  // 3. NDPA 2023 & GDPR PRIVACY POLICY
  // ==========================================
  const privacySections = [
    {
      id: 'privacy-introduction',
      title: '1. Introduction & Statutory Legal Framework',
      content: (
        <>
          <p className="mb-4">
            JAHZJOURNALS is dedicated to safeguarding the privacy, confidentiality, and integrity of your personal information and proprietary trading records. This Privacy Policy outlines our data processing standards in strict accordance with:
          </p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-xs">
            <li><strong>Nigeria Data Protection Act 2023 (NDPA)</strong> and the Nigeria Data Protection Regulation (NDPR 2019);</li>
            <li><strong>General Data Protection Regulation (GDPR - Regulation (EU) 2016/679)</strong> and UK GDPR;</li>
            <li><strong>California Consumer Privacy Act (CCPA)</strong> and applicable global data privacy statutes.</li>
          </ul>
          <p className="mb-4">
            By accessing or registering with JAHZJOURNALS, you acknowledge our data collection, storage, and processing practices as detailed below.
          </p>
        </>
      ),
    },
    {
      id: 'data-we-collect',
      title: '2. Information We Collect & Lawful Bases for Processing',
      content: (
        <>
          <p className="mb-4">
            Under the NDPA 2023 and GDPR, we process personal data strictly pursuant to lawful bases, including contractual performance, legitimate interests, legal obligations, and your explicit consent:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Account Identity Data:</strong> Full name, verified email address, hashed password (salted bcrypt cost factor 10), country of residence, preferred timezone, and optional profile avatar. <em>(Basis: Contractual Performance)</em></li>
            <li><strong>Trading Journal Data:</strong> Individual trade logs (currency pair, execution direction, lot sizes, entry/exit prices, stop-loss, take-profit, net P&L, commissions, session, tags, setup strategies, execution psychology, and reflective notes). <em>(Basis: Contractual Performance)</em></li>
            <li><strong>Chart Screenshots & Media:</strong> Uploaded chart screenshots and trade execution captures, stored securely via Cloudinary. <em>(Basis: Contractual Performance)</em></li>
            <li><strong>Billing & Payment References:</strong> Subscription tier, plan status, Paystack customer and subscription references. We do NOT collect or store complete payment card numbers or CVV codes. <em>(Basis: Contractual Performance & Legal Compliance)</em></li>
            <li><strong>Technical Telemetry:</strong> Anonymized server access logs, IP hash tokens, device/browser headers, and session timestamps. <em>(Basis: Legitimate Interests & System Security)</em></li>
          </ul>
        </>
      ),
    },
    {
      id: 'zero-sharing-guarantee',
      title: '3. Proprietary Trading Data Safeguards (Strict Zero-Sharing)',
      content: (
        <>
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 mb-4 text-xs text-emerald-300 font-semibold leading-relaxed">
            OUR ZERO-DATA-SHARING PROMISE: YOUR PRIVATE TRADING RECORDS, JOURNAL LOGS, SCREENSHOTS, STRATEGIES, AND ACCOUNT BALANCES ARE NEVER SOLD, RENTED, OR DISCLOSED TO ADVERTISERS, BROKERS, OR UNRELATED THIRD PARTIES.
          </div>
          <p className="mb-4">
            Unlike social brokers or free journals that monetize user order flow, JAHZJOURNALS is funded entirely by sustainable subscription fees. Your trades are strictly private to your account unless you explicitly choose to share an individual trade into a mentor cohort feed.
          </p>
        </>
      ),
    },
    {
      id: 'subprocessors',
      title: '4. Third-Party Infrastructure Subprocessors',
      content: (
        <>
          <p className="mb-4">
            We partner with industry-leading, compliant subprocessors to deliver platform capabilities under strict data processing agreements:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Paystack Payments Limited</strong> — PCI-DSS Level 1 compliant payment gateway handling recurring subscriptions and mentor subaccount settlements.</li>
            <li><strong>Cloudinary Inc.</strong> — Cloud media storage and encrypted content delivery network (CDN) for chart screenshots and profile imagery.</li>
            <li><strong>Brevo (formerly Sendinblue)</strong> — Transactional email delivery service for email verification, password resets, and critical account notices.</li>
            <li><strong>OpenAI / OpenRouter</strong> — Enterprise API infrastructure for JAHZ AI trade reviews and OCR image parsing. Operates under zero-data-retention agreements; customer prompts are not used to train public LLM models.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'data-subject-rights',
      title: '5. Your Legal Rights under NDPA 2023 & GDPR',
      content: (
        <>
          <p className="mb-4">
            Under the Nigeria Data Protection Act 2023 and GDPR, you possess comprehensive rights regarding your personal data:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Right of Access & Portability:</strong> You can export your entire trading history, analytics, and journal records in structured CSV or JSON formats at any time via <strong>Settings &rarr; Data & Privacy &rarr; Export</strong>.</li>
            <li><strong>Right to Rectification:</strong> You may update, correct, or refine inaccurate profile data or trade entries directly through the platform.</li>
            <li><strong>Right to Erasure ("Right to Be Forgotten"):</strong> You may permanently delete your account at any time via <strong>Settings &rarr; Data & Privacy &rarr; Delete Account</strong>. Account deletion immediately and permanently purges your trades, screenshots, AI reviews, and personal identifiers from active databases.</li>
            <li><strong>Right to Object & Restrict Processing:</strong> You have the right to withdraw non-essential data consent or lodge complaints directly with the <strong>Nigeria Data Protection Commission (NDPC)</strong> at <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">https://ndpc.gov.ng</a>.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'data-security-measures',
      title: '6. Information Security & Encryption Standards',
      content: (
        <>
          <p className="mb-4">
            JAHZJOURNALS employs multi-layered administrative, technical, and physical safeguards:
          </p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-xs">
            <li>Industry-standard TLS 1.3 cryptographic protocols for all data in transit;</li>
            <li>AES-256 database-level encryption for sensitive configurations and storage assets;</li>
            <li>Salted bcrypt hashing with cost factor 10 for password protection;</li>
            <li>Secure, HTTP-only, SameSite session cookies preventing cross-site scripting (XSS) and CSRF attacks.</li>
          </ul>
        </>
      ),
    },
  ];

  // ==========================================
  // 4. REFUND & CANCELLATION POLICY
  // ==========================================
  const refundSections = [
    {
      id: 'refund-overview',
      title: '1. Policy Overview & Commitment to Fairness',
      content: (
        <>
          <p className="mb-4">
            At JAHZJOURNALS, our goal is to help traders build discipline and understand their statistical edge. We are committed to transparent, fair, and frictionless billing management. This Refund & Cancellation Policy sets forth the terms governing subscription cancellations, trial periods, and refund eligibility.
          </p>
        </>
      ),
    },
    {
      id: 'self-service-cancellation',
      title: '2. 1-Click Self-Service Cancellation',
      content: (
        <>
          <p className="mb-4">
            You are in complete control of your subscription. You can cancel your paid plan at any time with a single click:
          </p>
          <ol className="list-decimal pl-6 space-y-1 mb-4 text-xs">
            <li>Log into your JAHZJOURNALS account;</li>
            <li>Navigate to <strong>Settings &rarr; Subscription & Plan</strong>;</li>
            <li>Click <strong>Cancel Subscription</strong> and confirm.</li>
          </ol>
          <p className="mb-4">
            Upon cancellation, your subscription will not renew, and Paystack will not charge your card again. You will continue to enjoy uninterrupted access to your paid tier features until the conclusion of your current paid billing period.
          </p>
        </>
      ),
    },
    {
      id: 'refund-eligibility',
      title: '3. Refund Eligibility Criteria',
      content: (
        <>
          <p className="mb-4">
            Because JAHZJOURNALS provides immediate access to digital cloud services, server infrastructure, and AI compute upon payment, recurring monthly and annual subscriptions are generally non-refundable once activated.
          </p>
          <p className="mb-4">
            However, we provide full refunds under the following specific conditions:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li><strong>Technical Gateway Errors:</strong> Duplicate charges or incorrect billing amounts verified through Paystack transaction logs will be refunded immediately.</li>
            <li><strong>48-Hour Inactivity Courtesy Window:</strong> If an automated monthly renewal occurred by accident and you contact support within <strong>48 hours</strong> of the charge—provided you have not logged any new trades, uploaded screenshots, or generated AI reviews during that renewed cycle—a full refund will be processed upon request.</li>
            <li><strong>Service Outage:</strong> Severe and sustained platform downtime directly attributable to JAHZJOURNALS core infrastructure exceeding 72 consecutive hours during a billing cycle.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'chargeback-procedure',
      title: '4. Chargebacks & Payment Inquiries',
      content: (
        <>
          <p className="mb-4">
            We strongly encourage traders to contact our customer support desk before initiating a bank chargeback or dispute. Banking chargebacks incur significant administrative delays and can cause automatic merchant account freezes. Our support team typically investigates and resolves legitimate billing inquiries within <strong>24 business hours</strong>.
          </p>
          <p className="mb-4">
            To submit a billing inquiry or refund request, email <a href="mailto:jahzjournals@gmail.com" className="text-emerald-400 underline">jahzjournals@gmail.com</a> with your registered email and Paystack transaction reference number.
          </p>
        </>
      ),
    },
  ];

  // ==========================================
  // 5. COOKIE & WEB STORAGE POLICY
  // ==========================================
  const cookieSections = [
    {
      id: 'cookies-overview',
      title: '1. What Are Cookies & Web Storage Technologies',
      content: (
        <>
          <p className="mb-4">
            Cookies are small text files placed on your device by websites you visit. In addition to standard cookies, modern web applications utilize browser Web Storage (such as <code>localStorage</code>) to maintain user interface preferences, theme states, and security session integrity.
          </p>
        </>
      ),
    },
    {
      id: 'technologies-we-use',
      title: '2. Technologies Used by JAHZJOURNALS',
      content: (
        <>
          <p className="mb-4 font-semibold text-emerald-400">Strictly Essential Technologies (Always Active):</p>
          <ul className="list-disc pl-6 space-y-2 mb-4 text-xs">
            <li><code>jwt</code> (Cookie): An encrypted, HTTP-only, secure authentication token required to verify your login session, protect against session hijacking, and safeguard trading data.</li>
            <li><code>jahzjournals-consent</code> (localStorage): Records your cookie and privacy preferences across sessions.</li>
          </ul>

          <p className="mb-4 font-semibold text-emerald-400">Functional & Preference Technologies (localStorage):</p>
          <ul className="list-disc pl-6 space-y-2 mb-4 text-xs">
            <li><code>jahzjournals-theme</code>: Stores your UI color mode preference (Dark / Light).</li>
            <li><code>jahzjournal-sidebar-collapsed</code>: Remembers your sidebar navigation display state.</li>
            <li><code>dismissed_announcements</code>: Prevents previously acknowledged announcements from redisplaying.</li>
            <li><code>jahzjournal:data-version</code>: Synchronizes local client state with the latest server data.</li>
          </ul>

          <p className="mb-4 text-xs leading-relaxed">
            <strong>Advertising Cookies (Public Pages Only):</strong> On eligible public marketing and educational blog pages, third-party advertising providers (such as Google AdSense) may set cookies to measure ad performance. You can manage or disable advertising cookies at any time through our Privacy Choices banner or your browser settings. <strong>No advertising cookies or scripts are ever loaded on authenticated trader dashboard pages.</strong>
          </p>
        </>
      ),
    },
    {
      id: 'managing-cookies',
      title: '3. How to Manage Your Preferences',
      content: (
        <>
          <p className="mb-4">
            You can modify your preferences at any time by clicking the <strong>Privacy Settings</strong> link in the platform footer or adjusting your browser's cookie settings. Please note that blocking strictly essential cookies will prevent authentication and platform access.
          </p>
        </>
      ),
    },
  ];

  // Content Map
  const contentMap = {
    privacy: { title: 'Privacy Policy (NDPA & GDPR Compliant)', sections: privacySections, date: 'November 2026' },
    terms: { title: 'Terms of Service & User Agreement', sections: termsSections, date: 'November 2026' },
    cookies: { title: 'Cookie & Web Storage Policy', sections: cookieSections, date: 'November 2026' },
    disclaimer: { title: 'Risk Disclosure & Statutory Financial Disclaimer', sections: disclaimerSections, date: 'November 2026' },
    refund: { title: 'Refund & Subscription Cancellation Policy', sections: refundSections, date: 'November 2026' },
  };

  const { title, sections, date } = contentMap[type] || contentMap.terms;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <SEO title={title} description={`${title} for JAHZJOURNALS platform. Compliance, data protection, and operational disclosures.`} />
      <Navbar />
      
      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Breadcrumbs />
        
        {/* Header Banner */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldCheck size={14} />
            <span>Official Legal Suite</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">{title}</h1>
          {date && (
            <p className="text-xs text-muted mt-2">
              Last updated: <span className="text-foreground font-semibold">{date}</span> &bull; Compliance: Federal Republic of Nigeria (NDPA 2023) & International Standards
            </p>
          )}
        </div>

        {/* Quick Document Navigation Pills */}
        <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-border pb-4 text-xs font-bold">
          <Link
            to="/terms"
            className={`px-3 py-1.5 rounded-lg border transition ${
              type === 'terms' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-surface border-border text-muted hover:text-foreground'
            }`}
          >
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            className={`px-3 py-1.5 rounded-lg border transition ${
              type === 'privacy' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-surface border-border text-muted hover:text-foreground'
            }`}
          >
            Privacy Policy (NDPA)
          </Link>
          <Link
            to="/disclaimer"
            className={`px-3 py-1.5 rounded-lg border transition ${
              type === 'disclaimer' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-surface border-border text-muted hover:text-foreground'
            }`}
          >
            Risk Disclaimer
          </Link>
          <Link
            to="/refund"
            className={`px-3 py-1.5 rounded-lg border transition ${
              type === 'refund' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-surface border-border text-muted hover:text-foreground'
            }`}
          >
            Refund Policy
          </Link>
          <Link
            to="/cookies"
            className={`px-3 py-1.5 rounded-lg border transition ${
              type === 'cookies' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-surface border-border text-muted hover:text-foreground'
            }`}
          >
            Cookie Policy
          </Link>
        </div>
        
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-10 shadow-xl">
          {/* Table of Contents */}
          <div className="mb-10 bg-surface-muted/40 p-5 rounded-xl border border-border/70">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
              <FileText size={14} className="text-emerald-400" />
              <span>Table of Contents</span>
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {sections.map(section => (
                <li key={`toc-${section.id}`}>
                  <a href={`#${section.id}`} className="text-emerald-400 hover:text-emerald-300 hover:underline transition">
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Sections Content */}
          <div className="space-y-12">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-base sm:text-lg font-black text-foreground mb-3 pb-2 border-b border-border/40">
                  {section.title}
                </h2>
                <div className="text-xs sm:text-sm text-muted leading-relaxed">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

          {/* Dedicated Support Callout */}
          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-muted/30 p-5 rounded-xl border">
            <div>
              <h4 className="text-xs font-bold text-foreground">Need legal or compliance clarification?</h4>
              <p className="text-[11px] text-muted mt-0.5">Our support desk is monitored daily to answer regulatory or privacy questions.</p>
            </div>
            <Link
              to="/support"
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-gray-950 transition whitespace-nowrap shadow-xs"
            >
              Contact Support Desk →
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Legal;
