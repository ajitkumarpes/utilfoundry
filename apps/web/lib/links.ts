/**
 * Where the landing page points. Next.js bakes NEXT_PUBLIC_* in at build time;
 * the defaults are the production hostnames.
 */
export const PDF_URL = process.env.NEXT_PUBLIC_PDF_URL || "https://pdf.utilfoundry.com";
export const DEVELOPER_URL = process.env.NEXT_PUBLIC_DEVELOPER_URL || "https://dev.utilfoundry.com";
export const IMAGES_URL = process.env.NEXT_PUBLIC_IMAGES_URL || "https://images.utilfoundry.com";

/** A mailto: address or form URL. Unset means there is no contact channel yet, so nothing links to one. */
export const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || "";
