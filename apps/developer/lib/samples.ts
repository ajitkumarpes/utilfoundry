/** The example input each tool starts with, keyed by tool id. */
export const STARTERS: Record<string, string> = {
  json: '{"project":"UtilFoundry","private":true,"tools":["json","jwt"]}',
  base64: "UtilFoundry developer tools",
  url: "https://utilfoundry.com/tools?q=hello world",
  jwt: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyIiwicm9sZSI6ImRldmVsb3BlciJ9.",
  hash: "Hash this text locally",
  uuid: "",
  timestamp: "",
  regex: "The quick brown fox jumps over the lazy dog.",
  markdown: "# Hello, developer\n\nWrite Markdown and see a **live preview**.",
  yaml: "name: UtilFoundry\nprivate: true\ntools:\n  - json\n  - jwt",
  curl: '{"method":"GET","url":"https://api.example.com/users"}',
  diff: "before\n---\nafter",
  xml: "<project><name>UtilFoundry</name><private>true</private></project>",
  csv: "name,phase,private\nJSON,1,true\nJWT,1,true",
  html: '<section class="hero">UtilFoundry & tools</section>',
  sql: "select id, email from users where active = true order by created_at desc;",
  graphql: "query User($id: ID!) { user(id: $id) { id email } }",
  query: "https://utilfoundry.com/tools?category=security&phase=1&private=true",
  number: "255",
  color: "#4263EB",
  status: "404",
  cron: "*/15 9-17 * * 1-5",
  "json-validator": '{"ok":true}',
  "json-minifier": '{\n  "ok": true,\n  "items": [1, 2, 3]\n}',
  jsonpath: '{"user":{"name":"Asha","roles":["admin"]}}',
  "json-diff": '{"name":"before"}\n---\n{"name":"after","active":true}',
  "xml-validator": "<root><item>Valid</item></root>",
  "yaml-formatter": "name: UtilFoundry\nprivate: true\ntools:\n  - json\n  - jwt",
  password: "",
  whitespace: "hello   world\n\n\nnext line  ",
  "line-sort": "zebra\napple\nBanana\napple",
  "line-dedupe": "apple\nbanana\napple\ncarrot",
  "iso-date": "2026-09-05 14:30",
  timezone: "2026-09-05T14:30:00Z",
  "url-parser": "https://api.utilfoundry.com:443/v1/users?active=true#top",
  "code-formatter": "function hello(name){return {message:'Hello '+name};}",
  "csv-viewer": "name,role\nAsha,admin\nDev,member",
  mime: "application/json",
  "openapi-viewer": '{"openapi":"3.0.3","info":{"title":"Demo API","version":"1.0.0"},"paths":{"/users":{"get":{}}}}',
  "openapi-validator": '{"openapi":"3.0.3","info":{"title":"Demo API","version":"1.0.0"},"paths":{}}',
  "json-schema": '{"name":"Asha","age":30}',
  "regex-visualizer": "^(?<user>[a-z]+)@(example\\.com)$",
  "docker-compose": "services:\n  api:\n    image: node:22\n  db:\n    image: postgres:16",
  gitignore: "Node, macOS",
  nginx: "server { listen 80; location / { proxy_pass http://api; } }",
  "jwt-sign": '{"sub":"user-123","role":"developer"}',
  cert: "",
  pem: "",
  webhook: '{"event":"deployment.completed","id":"evt_123"}',
  "api-request": '{"method":"POST","url":"https://api.example.com/users","headers":{"content-type":"application/json"},"body":{"name":"Asha"}}',
  "image-base64": "data:image/svg+xml;base64,PHN2Zy8+",
  qr: "https://utilfoundry.com",
  semver: "1.4.0 1.3.9",
  env: "PORT=3000\nNODE_ENV=production\n# comment\nAPI_URL=https://api.example.com",
  "openapi-diff":
    '{"openapi":"3.0.3","info":{"title":"Demo","version":"1"},"paths":{"/users":{"get":{"responses":{"200":{"description":"ok"},"404":{"description":"missing"}}}}}}\n---\n{"openapi":"3.0.3","info":{"title":"Demo","version":"2"},"paths":{"/users":{"get":{"responses":{"200":{"description":"ok"}}}}}}',
  "json-schema-generator": '{"name":"Asha","age":30,"active":true}',
  "jwt-rsa": 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.signature\n---\n{"kty":"RSA","n":"","e":"AQAB"}',
  "log-redactor": "INFO authorization: Bearer eyJhbGciOiJub25lIn0.secret\nuser email=a@example.com api_key=sk_live_example",
  protobuf: "08 96 01 12 05 48 65 6C 6C 6F",
  asn1: "30 0A 02 01 05 04 05 48 65 6C 6C 6F",
  "regex-safe": "aaaaaaaaaaaaaaaaaaaaaaaa",
  hex: "UtilFoundry payments",
  binary: "4A 53 4F 4E",
  bcd: "1234567890",
  ebcdic: "C1 C2 C3 40 F1 F2 F3",
  "iso-bitmap": "7220000000000000",
  iso8583: "MTI=0200\nBITMAP=7220000000000000\n2=411111******1111\n3=000000\n4=000000001000",
  "emv-tlv": "9F2608A1B2C3D4E5F60708 9F270180 9F100706010A03A00000",
  luhn: "4111111111111111",
  track2: "411111******1111=25122010000012345678"
};

/** What the tool's single option field starts at, where it has one. */
export function defaultOption(id: string) {
  if (id === "hash") return "SHA-256";
  if (id === "number") return "10";
  if (id === "jsonpath") return "$.user.name";
  if (id === "timezone") return "Asia/Kolkata";
  if (id === "code-formatter") return "javascript";
  if (id === "password") return "24";
  if (id === "jwt-sign") return "sign";
  if (id === "binary") return "hex-to-binary";
  return "encode";
}
