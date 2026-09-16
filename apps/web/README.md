# UtilFoundry landing page

The main `utilfoundry.com` landing page for the UtilFoundry platform. It links to the PDF, developer-tool and image-tool workspaces:

- `pdf.utilfoundry.com`
- `dev.utilfoundry.com`
- `images.utilfoundry.com`

To point the cards at local servers, set `NEXT_PUBLIC_PDF_URL`, `NEXT_PUBLIC_DEVELOPER_URL` and
`NEXT_PUBLIC_IMAGES_URL` in `.env.local`. `lib/links.ts` reads them, with the production hostnames
as defaults, and the container takes the same names as build args.

## Design

The page shares its design system with the tool apps: the same tokens, the same accent, and the
same dark theme applied before paint from the `utilfoundry-theme` key in `localStorage` — so a
visitor who picks dark in a tool keeps it here. Type is Inter, self-hosted through `next/font`, and
spacing follows one 4px scale rather than per-section numbers.

The tool counts on the page (36 PDF, 70 developer, 30 image) are the real number of tool pages in
each app. Keep them in step when a workspace gains a tool.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

`npm run test:e2e` runs an Axe accessibility scan of the page in both themes on port 3051
(`E2E_PRODUCTION=1` scans the built output instead of the dev server), and checks the two things
that were previously wrong here: that every product is reachable from the footer, and that the page
has a working skip link and theme toggle.

## Container

```bash
docker build -t utilfoundry-web .
docker run --rm -p 3000:3000 utilfoundry-web
```
