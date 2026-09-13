# Enterprise release checklist

This project is browser-first and local-only by design. Before a public release:

## Required CI gates

- `npm ci`
- `npm run lint`
- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`
- Chromium, Firefox, and WebKit Playwright coverage with `E2E_ALL_BROWSERS=1`
- Accessibility scan with zero Axe violations

## Security boundary

Tool input is not uploaded by the application. Do not add analytics that captures editor content. Keep the CSP, same-origin policies, and restrictive Permissions Policy enabled. Treat JWTs, keys, PANs, Track 2 data, PIN blocks, and EMV payloads as sensitive even when local processing is used. The detection banner is advisory and must not be described as a DLP control.

Payment tools are generic diagnostics only. They are not HSM-backed, PCI certification, Visa/Mastercard network validation, or production transaction processing. Add approved, versioned scheme profiles and external compliance review before making that claim.

## Operational release checks

- Deploy behind HTTPS with HSTS enabled only on the production domain.
- Verify CSP, `X-Content-Type-Options`, frame blocking, Referrer Policy, and Permissions Policy at the deployed URL.
- Run a smoke test after deployment and keep a documented rollback target.
- Test mobile Safari/Chrome, keyboard-only navigation, reduced-motion preferences, and screen readers.
- Test large JSON/CSV/XML/Markdown inputs for responsiveness and memory pressure.
- Review dependency licenses and run secret scanning on every pull request.

