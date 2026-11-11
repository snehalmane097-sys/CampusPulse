export async function workerPass(deps: { job: () => Promise<boolean>; cleanup: () => Promise<void>; wait: (ms: number) => Promise<void>; log: (message: string) => void }, lastCleanup: number) {
  let worked = false;
  try { worked = await deps.job(); }
  catch { deps.log("Worker database operation failed; retrying after backoff."); await deps.wait(5000); }
  if (Date.now() - lastCleanup > 60000) {
    try { await deps.cleanup(); } catch { deps.log("Evidence cleanup failed; queued work will continue and cleanup will retry."); }
    lastCleanup = Date.now();
  }
  return { worked, lastCleanup };
}
