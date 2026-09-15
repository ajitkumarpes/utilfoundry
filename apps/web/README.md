# UtilFoundry landing page

The main `utilfoundry.com` landing page for the UtilFoundry platform. It links to the PDF, developer-tool and image-tool workspaces:

- `pdf.utilfoundry.com`
- `dev.utilfoundry.com`
- `images.utilfoundry.com`

To point the cards at local servers, set `NEXT_PUBLIC_PDF_URL`, `NEXT_PUBLIC_DEVELOPER_URL` and
`NEXT_PUBLIC_IMAGES_URL` in `.env.local`.

## Local development

```bash
npm install
npm run dev
```

## Container

```bash
docker build -t utilfoundry-web .
docker run --rm -p 3000:3000 utilfoundry-web
```
