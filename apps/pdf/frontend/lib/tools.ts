export type ToolIconKey = "layers" | "repeat" | "file" | "optimize" | "shield";

/** Fixed per-category accent — intentionally constant across all site themes (see globals.css). */
export type CategoryColor = "red" | "blue" | "green" | "orange" | "purple";

export type PdfTool = {
  name: string;
  href: `/tools/${string}`;
};

export type ToolGroup = {
  id: string;
  title: string;
  description: string;
  icon: ToolIconKey;
  color: CategoryColor;
  tools: PdfTool[];
};

/** The single source of truth for navigation, search, sitemap and tool-count copy. */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "organize-tools",
    title: "Organize & Combine",
    description: "Merge, split, rearrange and manage your PDF pages.",
    icon: "layers",
    color: "red",
    tools: [
      { name: "Merge PDF", href: "/tools/merge-pdf" },
      { name: "Split PDF", href: "/tools/split-pdf" },
      { name: "Organize Pages", href: "/tools/organize-pdf" },
      { name: "OCR PDF", href: "/tools/ocr-pdf" },
      { name: "Rotate PDF", href: "/tools/rotate-pdf" },
      { name: "Crop PDF", href: "/tools/crop-pdf" },
      { name: "Repair PDF", href: "/tools/repair-pdf" },
      { name: "Edit PDF", href: "/tools/edit-pdf" },
      { name: "Edit PDF Metadata", href: "/tools/edit-metadata" },
      { name: "Pages per Sheet", href: "/tools/pages-per-sheet" },
      { name: "Edit Bookmarks", href: "/tools/bookmarks-pdf" }
    ]
  },
  {
    id: "convert-tools",
    title: "Convert",
    description: "Convert PDFs to and from multiple formats.",
    icon: "repeat",
    color: "blue",
    tools: [
      { name: "Image to PDF", href: "/tools/image-to-pdf" },
      { name: "PDF to Image", href: "/tools/pdf-to-image" },
      { name: "PDF to Text", href: "/tools/pdf-to-text" },
      { name: "Text to PDF", href: "/tools/text-to-pdf" },
      { name: "Markdown to PDF", href: "/tools/markdown-to-pdf" },
      { name: "HTML to PDF", href: "/tools/html-to-pdf" }
    ]
  },
  {
    id: "office-tools",
    title: "Convert Office Files",
    description: "Work with Word, Excel, PowerPoint and more.",
    icon: "file",
    color: "green",
    tools: [
      { name: "Word to PDF", href: "/tools/word-to-pdf" },
      { name: "Excel to PDF", href: "/tools/excel-to-pdf" },
      { name: "PowerPoint to PDF", href: "/tools/ppt-to-pdf" },
      { name: "PDF to Word", href: "/tools/pdf-to-word" },
      { name: "PDF to PowerPoint", href: "/tools/pdf-to-ppt" }
    ]
  },
  {
    id: "optimize-tools",
    title: "Optimize & Extract",
    description: "Reduce file size and extract content from PDFs.",
    icon: "optimize",
    color: "orange",
    tools: [
      { name: "Compress PDF", href: "/tools/compress-pdf" },
      { name: "Grayscale PDF", href: "/tools/grayscale-pdf" },
      { name: "Extract Images", href: "/tools/extract-images" },
      { name: "Extract Links", href: "/tools/extract-links" },
      { name: "Extract Attachments", href: "/tools/extract-attachments" },
      { name: "Extract Fonts", href: "/tools/extract-fonts" }
    ]
  },
  {
    id: "protect-tools",
    title: "Protect & Sign",
    description: "Add security, watermarks and signatures.",
    icon: "shield",
    color: "purple",
    tools: [
      { name: "Add Watermark", href: "/tools/watermark-pdf" },
      { name: "Add Page Numbers", href: "/tools/page-numbers-pdf" },
      { name: "Lock PDF", href: "/tools/lock-pdf" },
      { name: "Unlock PDF", href: "/tools/unlock-pdf" },
      { name: "Sign PDF", href: "/tools/sign-pdf" },
      { name: "Redact PDF", href: "/tools/redact-pdf" },
      { name: "Sanitize PDF", href: "/tools/sanitize-pdf" },
      { name: "Flatten PDF", href: "/tools/flatten-pdf" },
      { name: "Header & Footer", href: "/tools/header-footer-pdf" }
    ]
  }
];

export type SearchableTool = PdfTool & { groupId: string; groupTitle: string; color: CategoryColor };

export const ALL_TOOLS: SearchableTool[] = TOOL_GROUPS.flatMap(group =>
  group.tools.map(tool => ({ ...tool, groupId: group.id, groupTitle: group.title, color: group.color }))
);
export const TOOL_ROUTES = ALL_TOOLS.map(tool => tool.href);
export const TOOL_COUNT = ALL_TOOLS.length;

/** Shared by the header quick-search and any other tool-name search UI. */
export function searchTools(query: string, limit = 8): SearchableTool[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return ALL_TOOLS.filter(tool => tool.name.toLowerCase().includes(normalized)).slice(0, limit);
}
