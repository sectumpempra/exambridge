import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"]).toString("utf8").split("\0").filter(Boolean);
const patterns = [
  ["private-key", /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/],
  ["api-secret", /\b(?:sk|ghp)[-_][A-Za-z0-9_-]{20,}\b/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["moonshot-env-value", /MOONSHOT_API_KEY\s*=\s*[^\s'"$][^\s]*/],
];
const findings = [];
for (const file of files) {
  let bytes;
  try { bytes = readFileSync(file); } catch { continue; }
  if (bytes.length > 2_000_000 || bytes.includes(0)) continue;
  const text = bytes.toString("utf8");
  for (const [kind, pattern] of patterns) if (pattern.test(text)) findings.push(`${file}: ${kind}`);
}
if (findings.length) {
  console.error(`Potential repository secrets detected:\n${findings.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Repository secret scan passed: ${files.length} tracked files checked.`);
}
