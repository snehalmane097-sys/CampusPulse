require("@next/env").loadEnvConfig(process.cwd());
const version = require("next/package.json").version.split(".").map(Number);
const failures = [];
if (version[0] < 15 || (version[0] === 15 && (version[1] < 5 || version[1] === 5 && version[2] < 29)) || (version[0] === 16 && (version[1] < 4 || version[1] === 4 && version[2] < 5))) failures.push("Installed Next.js is below the audited security baseline. Install a currently patched supported release; see docs/OPERATIONS.md.");
for (const key of ["MONGODB_URI", "JWT_SECRET", "APP_ORIGIN", "AWS_REGION", "S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "CLAMAV_HOST", "RESEND_API_KEY", "EMAIL_FROM"]) if (!process.env[key]) failures.push(key + " is required.");
if ((process.env.JWT_SECRET || "").length < 32 || /^(change-this|replace-this)/i.test(process.env.JWT_SECRET || "")) failures.push("JWT_SECRET must have at least 32 characters.");
if (!process.env.APP_ORIGIN?.startsWith("https://")) failures.push("APP_ORIGIN must use HTTPS.");
for (const [key,value] of Object.entries({ STORAGE_DRIVER: "s3", SCANNER_DRIVER: "clamav", EMAIL_DRIVER: "resend" })) if (process.env[key] !== value) failures.push(key + " must be " + value + " in production.");
if (failures.length) { console.error("Production preflight failed:\n- " + failures.join("\n- ")); process.exitCode = 1; } else console.log("Configuration checks passed. External service connectivity is not verified by this check.");
