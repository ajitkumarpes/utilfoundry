# UtilFoundry landing page

The main `utilfoundry.com` landing page for the UtilFoundry platform. It links to the independent PDF and developer-tool workspaces:

- `pdf.utilfoundry.com`
- `dev.utilfoundry.com`

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
