# UtilNexa landing page

The main `utilnexa.com` landing page for the UtilNexa platform. It links to the independent PDF and developer-tool workspaces:

- `pdf.utilnexa.com`
- `dev.utilnexa.com`

## Local development

```bash
npm install
npm run dev
```

## Container

```bash
docker build -t utilnexa-web .
docker run --rm -p 3000:3000 utilnexa-web
```

