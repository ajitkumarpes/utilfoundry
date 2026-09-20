/**
 * Where the header, footer and feedback prompts point. Next.js bakes NEXT_PUBLIC_* in
 * at build time; the defaults are the production hostnames.
 */
export const PARENT_URL = process.env.NEXT_PUBLIC_PARENT_URL || "https://utilfoundry.com";
export const PDF_URL = process.env.NEXT_PUBLIC_PDF_URL || "https://pdf.utilfoundry.com";
export const IMAGES_URL = process.env.NEXT_PUBLIC_IMAGES_URL || "https://images.utilfoundry.com";

/** Where the feedback widget and visit beacon send data. */
export const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.utilfoundry.com";

/** The address the privacy policy, the terms and every feedback prompt point at. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@utilfoundry.com";

/** Override with a form URL once one exists; the mailto: is the standing channel until then. */
export const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || `mailto:${CONTACT_EMAIL}`;
