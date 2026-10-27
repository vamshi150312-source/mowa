// `npm run dev:https`: the dev server over HTTPS, so phones and other computers on your
// network can use the camera and microphone (browsers only allow them on secure pages).
//
// Like mkcert, it makes a private "Mova dev" certificate authority (once), and with it a
// certificate for localhost and this computer's network addresses (again whenever the
// addresses change). On Windows it asks once to add the authority to your trusted
// certificates, so browsers on this computer show no warning. Other devices can install
// it from https://<this computer>:3000/mova-dev-ca.crt, or tap through the warning.
// The authority's private key never leaves the certificates/ folder.
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import forge from "node-forge";

const { pki, md } = forge;
const dir = path.resolve("certificates");
const files = {
  caKey: path.join(dir, "dev-ca-key.pem"),
  caCert: path.join(dir, "dev-ca.pem"),
  caTrusted: path.join(dir, "dev-ca-trusted"),
  key: path.join(dir, "dev-key.pem"),
  cert: path.join(dir, "dev-cert.pem"),
  hosts: path.join(dir, "dev-hosts.json"),
};
const publicCa = path.resolve("public", "mova-dev-ca.crt");

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254."))
  .map((a) => a.address);
const hosts = ["localhost", "127.0.0.1", ...ips];

function newCert(publicKey, years) {
  const cert = pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = "01" + forge.util.bytesToHex(forge.random.getBytesSync(15));
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + years * 365 * 86_400_000);
  return cert;
}

mkdirSync(dir, { recursive: true });

// 1. The certificate authority, made once.
let caKey, caCert;
if (existsSync(files.caKey) && existsSync(files.caCert)) {
  caKey = pki.privateKeyFromPem(readFileSync(files.caKey, "utf8"));
  caCert = pki.certificateFromPem(readFileSync(files.caCert, "utf8"));
} else {
  const keys = pki.rsa.generateKeyPair(2048);
  caKey = keys.privateKey;
  caCert = newCert(keys.publicKey, 10);
  const name = [
    { name: "commonName", value: "Mova dev CA" },
    { name: "organizationName", value: "Mova (local development)" },
  ];
  caCert.setSubject(name);
  caCert.setIssuer(name);
  caCert.setExtensions([
    { name: "basicConstraints", cA: true, pathLenConstraint: 0, critical: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
    { name: "subjectKeyIdentifier" },
  ]);
  caCert.sign(caKey, md.sha256.create());
  writeFileSync(files.caKey, pki.privateKeyToPem(caKey));
  writeFileSync(files.caCert, pki.certificateToPem(caCert));
  if (existsSync(files.caTrusted)) writeFileSync(files.caTrusted, ""); // a new authority needs trusting again
  console.log("Made the Mova dev certificate authority.");
}

// 2. The site certificate, signed by the authority. Remade when the network addresses change.
const caPem = readFileSync(files.caCert, "utf8");
const wanted = JSON.stringify({ hosts, ca: caCert.serialNumber });
const current = existsSync(files.hosts) && existsSync(files.key) && existsSync(files.cert) ? readFileSync(files.hosts, "utf8") : "";
if (current !== wanted) {
  const keys = pki.rsa.generateKeyPair(2048);
  // Browsers reject server certificates valid for more than about 13 months.
  const cert = newCert(keys.publicKey, 1);
  cert.setSubject([{ name: "commonName", value: "Mova dev" }]);
  cert.setIssuer(caCert.subject.attributes);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true, critical: true },
    { name: "extKeyUsage", serverAuth: true },
    { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, ...hosts.slice(1).map((ip) => ({ type: 7, ip }))] },
    { name: "authorityKeyIdentifier", keyIdentifier: caCert.generateSubjectKeyIdentifier().getBytes() },
  ]);
  cert.sign(caKey, md.sha256.create());
  writeFileSync(files.key, pki.privateKeyToPem(keys.privateKey));
  writeFileSync(files.cert, pki.certificateToPem(cert));
  writeFileSync(files.hosts, wanted);
  console.log(`Made a certificate for ${hosts.join(", ")}`);
}

// 3. Trust the authority on this computer (Windows asks you to confirm, once).
const trusted = existsSync(files.caTrusted) && readFileSync(files.caTrusted, "utf8") === caCert.serialNumber;
if (process.platform === "win32" && !trusted) {
  console.log("Adding the Mova dev certificate authority to your trusted certificates. Click Yes in the Windows dialog.");
  try {
    execFileSync("certutil", ["-user", "-addstore", "Root", files.caCert], { stdio: "ignore" });
    writeFileSync(files.caTrusted, caCert.serialNumber);
    console.log("Trusted. Restart your browser if it still shows a warning.");
  } catch {
    console.log("Not trusted (cancelled?). Browsers will warn; run `npm run dev:https` again to retry.");
  }
} else if (process.platform !== "win32" && !trusted) {
  console.log(`To stop browser warnings, trust ${files.caCert} in your system's certificate settings.`);
}

// 4. Let other devices download the authority's (public) certificate.
mkdirSync(path.dirname(publicCa), { recursive: true });
if (!existsSync(publicCa) || readFileSync(publicCa, "utf8") !== caPem) copyFileSync(files.caCert, publicCa);

const port = process.argv.includes("-p") ? process.argv[process.argv.indexOf("-p") + 1] : "3000";
for (const ip of ips) console.log(`  On your network: https://${ip}:${port}  (certificate for phones: https://${ip}:${port}/mova-dev-ca.crt)`);

const next = spawn(
  process.execPath,
  [
    path.resolve("node_modules/next/dist/bin/next"),
    "dev",
    "--experimental-https",
    "--experimental-https-key",
    files.key,
    "--experimental-https-cert",
    files.cert,
    "-H",
    "0.0.0.0",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);
next.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => next.kill(signal));
