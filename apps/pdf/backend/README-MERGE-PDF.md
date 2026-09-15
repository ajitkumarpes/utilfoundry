# PDF Backend — Merge PDF

This is the complete backend replacement for the current PDF platform backend.

## Merge endpoint

POST `/api/v1/pdf/merge`

Multipart field: `files` (repeat for each PDF, minimum 2).

The implementation uses Apache PDFBox 3.0.5 locally. No external PDF API is used.

## Run

From the project root:

```bash
docker compose down
docker compose up --build
```

## Test

```bash
curl -X POST http://localhost:8080/api/v1/pdf/merge \
  -F "files=@/Users/pallavimishra/Desktop/test1.pdf" \
  -F "files=@/Users/pallavimishra/Desktop/test2.pdf" \
  -o merged.pdf
```

Then:

```bash
ls -lh merged.pdf
file merged.pdf
```

The result should be a non-zero-size PDF beginning with `%PDF`.
