import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { runOneJob, cleanupEvidence } from "@/services/worker";
import { workerPass } from "@/services/workerLoop";
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { stopping = true; });
async function main() {
  await dbConnect(); let lastCleanup = 0;
  do {
    const pass = await workerPass({ job: runOneJob, cleanup: cleanupEvidence, wait: ms => new Promise(r => setTimeout(r, ms)), log: console.error }, lastCleanup);
    const worked = pass.worked; lastCleanup = pass.lastCleanup;
    if (process.argv.includes("--once")) break;
    if (!worked) await new Promise(r => setTimeout(r, 1000));
  } while (!stopping);
  await mongoose.disconnect();
}
main().catch(e => { console.error("Worker stopped:", e.message); process.exitCode = 1; mongoose.disconnect(); });
