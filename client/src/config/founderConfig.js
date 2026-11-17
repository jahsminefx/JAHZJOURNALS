/**
 * Founder & Leadership Configuration
 * 
 * Launch Readiness Policy:
 * To display a public founder section on the About page (/about), populate all fields
 * below with verified, approved details and set `isPublished: true`.
 * 
 * Do not publish placeholders or unverified personal links.
 */
export const FOUNDER_CONFIG = {
  isPublished: false, // Set to true once verified bio and avatar are supplied
  name: 'Jahsmine Aninta',
  role: 'Founder & Senior Architect',
  // TODO: Provide an approved, authentic biographical statement (1-2 paragraphs)
  bio: null,
  // TODO: Place an approved founder headshot in /public/team/ or provide Cloudinary URL
  avatarUrl: null,
  // Approved public social links (leave null if not approved for public display)
  socialLinks: {
    // TODO: Provide approved founder Twitter/X profile URL
    twitter: null,
    // TODO: Provide approved founder LinkedIn profile URL
    linkedin: null,
    // TODO: Provide approved founder GitHub profile URL
    github: null,
  },
};
