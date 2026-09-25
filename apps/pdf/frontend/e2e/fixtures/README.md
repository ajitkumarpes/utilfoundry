# Browser-suite fixtures

Small files for `e2e/round-trip.spec.ts`, one or more per tool. Each is made to exercise
something specific, so a tool's output can be checked for the right content:

| File | What it is |
| --- | --- |
| `three-pages.pdf`, `two-pages.pdf` | Plain text pages ("Report page N"), incl. a fake card number to redact |
| `with-image.pdf` | A page with an embedded PNG |
| `with-attachment.pdf` | A page with an attached `items.csv` |
| `with-link.pdf` | A page with a clickable link to https://utilfoundry.com/tools |
| `with-form.pdf` | A filled text field and a ticked checkbox |
| `embedded-fonts.pdf` | Text set in embedded Noto fonts (made by the app's own text-to-pdf) |
| `scanned.pdf` | An image-only page of a receipt: text only OCR can read |
| `locked.pdf` | `three-pages.pdf` encrypted with the password `open-sesame` (qpdf, AES-256) |
| `letter.docx`, `deck.pptx`, `sales.xlsx` | Office files made with LibreOffice from `letter.html`, `three-pages.pdf` and a CSV |
| `letter.html`, `notes.md`, `notes.txt` | Inputs for the HTML, Markdown and text converters |
| `receipt.png`, `mark.png` | Images for image-to-pdf and the signature upload |
| `sample.pdf` | The original one-page sample used by the render and upload checks |
