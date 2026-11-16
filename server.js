const { createServer } = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
require("@next/env").loadEnvConfig(__dirname);
const next = require("next");
const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);
const origin = process.env.APP_ORIGIN || "http://localhost:" + port;
if (!dev) { require("./scripts/preflight.cjs"); if (process.exitCode) process.exit(process.exitCode); }
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER } = require("next/constants");
const { outputDirectory } = require("./scripts/next-output.cjs");
const app = next({ dev, dir: __dirname });
console.log("CampusPulse " + (dev ? "development" : "production") + " output: " + outputDirectory(dev ? PHASE_DEVELOPMENT_SERVER : PHASE_PRODUCTION_SERVER));
async function socketIdentity(socket) {
  const cookies = Object.fromEntries((socket.handshake.headers.cookie || "").split(";").map(v => { const i = v.indexOf("="); return [v.slice(0, i).trim(), v.slice(i + 1)]; }));
  const payload = jwt.verify(cookies.cp_session || "", process.env.JWT_SECRET, { algorithms: ["HS256"], issuer: "campuspulse", audience: "campuspulse" });
  if (!mongoose.isValidObjectId(payload.userId) || !mongoose.isValidObjectId(payload.sessionId)) throw new Error("Invalid session");
  const [session, user] = await Promise.all([
    mongoose.connection.db.collection("sessions").findOne({ _id: new mongoose.Types.ObjectId(payload.sessionId), user: new mongoose.Types.ObjectId(payload.userId), expiresAt: { $gt: new Date() } }),
    mongoose.connection.db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(payload.userId), disabled: { $ne: true } }),
  ]);
  if (!session || !user) throw new Error("Expired session");
  return { ...payload, role: user.role };
}
app.prepare().then(async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /^(change-this|replace-this)/i.test(process.env.JWT_SECRET)) throw new Error("Configure JWT_SECRET with at least 32 characters.");
  if (!process.env.MONGODB_URI) throw new Error("Configure MONGODB_URI.");
  if (!dev && (!process.env.APP_ORIGIN?.startsWith("https://") || process.env.STORAGE_DRIVER !== "s3" || process.env.SCANNER_DRIVER !== "clamav" || process.env.EMAIL_DRIVER !== "resend")) throw new Error("Production requires HTTPS APP_ORIGIN, S3, ClamAV and Resend. See docs/OPERATIONS.md.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const handle = app.getRequestHandler();
  const httpServer = createServer(async (req, res) => {
    try { await handle(req, res); }
    catch (error) {
      console.error("Next request handler failed:", error.stack || error.message);
      if (!res.headersSent) { res.writeHead(500, { "Content-Type": "text/plain" }); res.end("Internal Server Error"); }
      else res.destroy();
    }
  });
  const io = new Server(httpServer, { path: "/api/socket", cors: { origin, credentials: true }, maxHttpBufferSize: 16384, allowRequest: (req, done) => done(null, req.headers.origin ? req.headers.origin === origin : req.headers.host === new URL(origin).host && req.headers["sec-fetch-site"] !== "cross-site") });
  io.use(async (socket, done) => { try { socket.data.identity = await socketIdentity(socket); done(); } catch { done(new Error("Authentication required")); } });
  io.on("connection", socket => {
    const identity = socket.data.identity;
    socket.join("user:" + identity.userId); socket.join("session:" + identity.sessionId);
    if (identity.role === "admin") socket.join("admin-room");
    socket.on("join", (_payload, ack) => { if (typeof ack === "function") ack({ ok: true }); });
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, identity.exp * 1000 - Date.now()));
    const revalidate = setInterval(async () => { try { const current = await socketIdentity(socket); if (current.role !== identity.role) socket.disconnect(true); } catch { socket.disconnect(true); } }, 30000);
    socket.on("disconnect", () => { clearTimeout(expiry); clearInterval(revalidate); });
  });
  global.__campuspulse_io = io;
  const changes = mongoose.connection.db.collection('notifications').watch([], { fullDocument: 'updateLookup' });
  changes.on('change', event => { const user = event.fullDocument?.user; if (user) io.to('user:' + user).emit('notification:changed'); });
  changes.on('error', () => console.error('Notification change stream unavailable; inbox polling remains enabled.'));
  httpServer.listen(port, () => console.log("CampusPulse 2.0 ready at " + origin));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { changes.close(); io.close(); httpServer.close(async () => { await mongoose.disconnect(); process.exit(0); }); });
}).catch(error => { console.error("Startup failed:", error.message); process.exitCode = 1; });
