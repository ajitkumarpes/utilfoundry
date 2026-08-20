# PDF Platform Frontend - Merge connected

The Merge PDF UI now calls:
http://localhost:8091/api/v1/pdf/merge

This is the host port exposed by the current Docker Compose backend.

No API key or external PDF service is used. PDF merging happens in the Spring Boot/PDFBox backend.

From the project root:
docker compose down
docker compose up --build

Open:
http://localhost:3000/tools/merge-pdf
