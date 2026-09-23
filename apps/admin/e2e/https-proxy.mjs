/**
 * A throwaway TLS front for the e2e server, playing the part Caddy plays in production.
 *
 * WebKit will not store a Secure cookie for plain http://localhost (Chromium and Firefox do),
 * and the session cookie is always Secure in a production build, so the WebKit project signs
 * in over https through this proxy. The certificate is self-signed, made fresh on each run,
 * and trusted only by that project (ignoreHTTPSErrors).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as forward } from "node:http";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

const listenPort = Number(process.env.PROXY_PORT);
const targetPort = Number(process.env.TARGET_PORT);

const dir = mkdtempSync(join(tmpdir(), "admin-e2e-tls-"));
execFileSync("openssl", [
  "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost",
  "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem")
], { stdio: "ignore" });
const tls = { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) };
rmSync(dir, { recursive: true, force: true });

createServer(tls, (request, response) => {
  const upstream = forward(
    {
      host: "127.0.0.1",
      port: targetPort,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, "x-forwarded-proto": "https" }
    },
    (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(response);
    }
  );
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502);
    response.end();
  });
  request.pipe(upstream);
}).listen(listenPort, () => console.log(`https proxy on ${listenPort} -> ${targetPort}`));
