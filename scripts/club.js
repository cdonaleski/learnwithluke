/**
 * Editing the locked club page.
 *
 * The club content is encrypted, which means it cannot simply be edited in
 * place. This is the way in and out:
 *
 *   node scripts/club.js unlock CC2026 > /tmp/club.html   # read it out
 *   ...edit /tmp/club.html...
 *   node scripts/club.js lock CC2026 /tmp/club.html       # seal it back up
 *
 * Note the /tmp. The repository is PUBLIC, so plaintext must never be written
 * inside it -- not even briefly, because a file committed once stays in the
 * history for ever. This script therefore never writes the content anywhere
 * except where you tell it to, and reading it out requires the password.
 *
 * The parameters match what gate.js expects in the browser: PBKDF2-SHA256 at
 * 250,000 rounds, then AES-256-GCM. Change them in one place and the other
 * stops working, so they are named here once.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROUNDS = 250000;
const LOCKED = path.join(__dirname, "..", "cube", "club", "locked.json");

function unlock(password) {
  const blob = JSON.parse(fs.readFileSync(LOCKED, "utf8"));
  const salt = Buffer.from(blob.salt, "base64");
  const iv = Buffer.from(blob.iv, "base64");
  const all = Buffer.from(blob.data, "base64");
  const body = all.subarray(0, all.length - 16);
  const tag = all.subarray(all.length - 16);
  const key = crypto.pbkdf2Sync(password, salt, blob.rounds, 32, "sha256");
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

function lock(password, file) {
  const content = fs.readFileSync(file, "utf8");
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, ROUNDS, 32, "sha256");
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(content, "utf8"), c.final()]);
  const blob = {
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    rounds: ROUNDS,
    data: Buffer.concat([enc, c.getAuthTag()]).toString("base64"),
  };
  fs.writeFileSync(LOCKED, JSON.stringify(blob, null, 1) + "\n");

  // Never trust a write you have not read back.
  const back = unlock(password);
  if (back !== content) throw new Error("the sealed file does not read back the same");
  return content.length;
}

const [, , command, password, file] = process.argv;
if (command === "unlock" && password) {
  process.stdout.write(unlock(password));
} else if (command === "lock" && password && file) {
  const n = lock(password, file);
  process.stderr.write("sealed " + n + " characters, and read them back unchanged\n");
} else {
  process.stderr.write("usage: club.js unlock <password> | club.js lock <password> <file>\n");
  process.exit(1);
}
