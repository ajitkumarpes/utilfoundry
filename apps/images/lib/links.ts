/**
 * Where the header, footer and feedback prompts point. Next.js bakes NEXT_PUBLIC_* in
 * at build time; the defaults are the production hostnames.
 */
export const PARENT_URL = process.env.NEXT_PUBLIC_PARENT_URL || "https://utilfoundry.com";
export const PDF_URL = process.env.NEXT_PUBLIC_PDF_URL || "https://pdf.utilfoundry.com";
export const DEVELOPER_URL = process.env.NEXT_PUBLIC_DEVELOPER_URL || "https://dev.utilfoundry.com";

/** A mailto: address or form URL. Unset means there is no contact channel yet, so nothing links to one. */
export const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || "";
