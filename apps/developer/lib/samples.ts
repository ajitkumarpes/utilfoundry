/** A throwaway self-signed certificate, generated for this file. It signs nothing real. */
const SAMPLE_CERTIFICATE = [
  "-----BEGIN CERTIFICATE-----",
  "MIIDYTCCAkmgAwIBAgIUXOsFrgfzBsAJHF5yPZZxmad5FtIwDQYJKoZIhvcNAQEL",
  "BQAwQDEhMB8GA1UEAwwYZXhhbXBsZS51dGlsZm91bmRyeS50ZXN0MRswGQYDVQQK",
  "DBJVdGlsRm91bmRyeSBTYW1wbGUwHhcNMjYwOTE2MTczMDIwWhcNMzYwOTEzMTcz",
  "MDIwWjBAMSEwHwYDVQQDDBhleGFtcGxlLnV0aWxmb3VuZHJ5LnRlc3QxGzAZBgNV",
  "BAoMElV0aWxGb3VuZHJ5IFNhbXBsZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCC",
  "AQoCggEBAKkjsUQ0DB5LWOzLE188fxcs3K3nAZeJvBVFVeZBYkyzwY2W1WMDMnuI",
  "XxrsPVWi0DmWlblsl+xDI8KW85iYnKX0rUR1zRzX6XxeQxE+9wotwFGxfZoQjVUa",
  "VqFs8uguQZ4xVn6GA8172N7DuEbZFjTIh9M/mJHK2vjQgooPgS6sOekbyfvc7T3M",
  "khiEXmmkmVO3HWqKiu2WgSq+mq+IjJ7AB/V5Y/3u8eRbKrLpI61U/QEgpUpo19OO",
  "VSrgWEdZWat+O3Y0FALLZYX7XQj/R56ZSKLGfFjkp4ynJKuFoFx6S7ef6ZhSh/7y",
  "Pkn0SfJr6wj4E7KqQERrlod5Z8jJ9/0CAwEAAaNTMFEwHQYDVR0OBBYEFJbdig2Q",
  "X2m4AGFs/L4Bgem6vyYlMB8GA1UdIwQYMBaAFJbdig2QX2m4AGFs/L4Bgem6vyYl",
  "MA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBABn/ccGpkC6T1lwP",
  "HepFD/fzxKmMsm02lIUKycNK3DDh81eeA1bGHaWulqxzfOUaAQSA2YAXpxOSwL+J",
  "V4IIhilra4GPUYgkPfR8gMKY0/dcy7nREDSJ0v0uKmjS8TIwc4rPBhLN9wsmXwd6",
  "flLafB01b+rd1c7+elHfa8HDvl5eSyy1itzC16adS8IJEvxQg0rbr0ja3I6sC6oE",
  "UpTglKnqedO4ApY6T/RIJ89mJ2aFqEzjM2ymuf9DGu2xscNXjViH4KKLnCrxutp2",
  "YlE0Y6ALxkm5c2lxDgPftBr7SHeL5OoJ99+S9Xc1uQ0brGzsd3j/k6OWzovCjQ02",
  "++dy3OU=",
  "-----END CERTIFICATE-----",
].join("\n");

/** A real RS256 token beside the public key that verifies it, so the example succeeds. */
const RS256_TOKEN_AND_JWK = [
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInJvbGUiOiJkZXZlbG9wZXIiLCJpYXQiOjE3ODkwMDAwMDB9.n5Q5wGAuXopC4ij4A2qtbbje3hlxkueUurkx0it7ZXtkJi48gW9UOz7quZNHT2lemV8hrv0AKbxlC1GWj2wVQGUUXjRx8z2yR-1mME0OuX4aBjjErrbTxjh4Rsion1E1jT4dLDGXdSIsQdE5ZFPw-zDf2kKIG5QYTT9010ZpXMf2UAwGXMU-BUfPcs2OvB-Xp70NX6PBBejv2yunCvkVxsBjxNLKz-joRbSdKglzX5l4UVkV-82uhUQu56sAV2ZyWNuhHR7QOaoJ4wIqF7DiTGOqil3cRY-eJOCsc_tyFEW5vPoZIba8wvwBvVctSP9I8kJWFS9ykJ9DlqpLljGK3w",
  '{"kty":"RSA","n":"ogUDIJ1SO3dL7vkby-Wwu1_Y0opDnbXu318RKnLpF2R99QEZXiWMZBXWqkqGkLoudlfw815NTyEZa5W5U8X3FsZ77qeOYP1XiZOWgMQ9XUX5f8AWd17Av3oNAF7lQdwwRcGPFeZHpnaojo9RM2cH-Gnt8sWCdMExAFw5IEwGBpM0OWhRsDpDK60rU_wR4QwdkVyN0xPxix6QlW_J93_WFdJRBXlQI7MJo8wniKkEFBETVdUxgWKV44aau3agxpcv0pXc1cVV5dxk-2byRPj7LJ98th4JeYp1xpK0FNNnXIYLZN0bwmiJKDkFKcEM-HpDlVpD1X2acGCKfcvlnj_90w","e":"AQAB"}',
].join("\n---\n");

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
  // Data first, then the schema it must satisfy. The age is a string on purpose, so the
  // result demonstrates a failure reported at the path that broke it.
  "json-schema":
    '{"name":"Asha","age":"30"}\n---\n{"type":"object","required":["name","age"],"properties":{"name":{"type":"string"},"age":{"type":"integer"}}}',
  "regex-visualizer": "^(?<user>[a-z]+)@(example\\.com)$",
  "docker-compose": "services:\n  api:\n    image: node:22\n  db:\n    image: postgres:16",
  gitignore: "Node, macOS",
  nginx: "server { listen 80; location / { proxy_pass http://api; } }",
  "jwt-sign": '{"sub":"user-123","role":"developer"}',
  cert: SAMPLE_CERTIFICATE,
  pem: SAMPLE_CERTIFICATE,
  webhook: '{"event":"deployment.completed","id":"evt_123"}',
  "api-request": '{"method":"POST","url":"https://api.example.com/users","headers":{"content-type":"application/json"},"body":{"name":"Asha"}}',
  "image-base64": "data:image/svg+xml;base64,PHN2Zy8+",
  qr: "https://utilfoundry.com",
  semver: "1.4.0 1.3.9",
  env: "PORT=3000\nNODE_ENV=production\n# comment\nAPI_URL=https://api.example.com",
  "openapi-diff":
    '{"openapi":"3.0.3","info":{"title":"Demo","version":"1"},"paths":{"/users":{"get":{"responses":{"200":{"description":"ok"},"404":{"description":"missing"}}}}}}\n---\n{"openapi":"3.0.3","info":{"title":"Demo","version":"2"},"paths":{"/users":{"get":{"responses":{"200":{"description":"ok"}}}}}}',
  "json-schema-generator": '{"name":"Asha","age":30,"active":true}',
  "jwt-rsa": RS256_TOKEN_AND_JWK,
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
  // These two read their own format first, which is the direction the tool is named for.
  if (id === "yaml" || id === "csv") return "decode";
  if (id === "binary") return "hex-to-binary";
  return "encode";
}
