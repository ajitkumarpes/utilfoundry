/**
 * Where the feedback widget and visit beacon send data. Next.js bakes NEXT_PUBLIC_*
 * in at build time; the default is the production hostname.
 */
export const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.utilfoundry.com";
