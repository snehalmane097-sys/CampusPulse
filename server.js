// Custom server: Next.js request handling + a Socket.IO server on the same
// HTTP server. This is what gives GrievanceNet-style "Pending -> In Progress
// -> Resolved" updates without the student refreshing the page.
const { createServer } = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    path: "/api/socket",
  });

  io.on("connection", (socket) => {
    // Each client joins a room per user (for personal grievance updates)
    // and/or the shared "admin" room (for dashboard-wide broadcasts). The
    // room a client is allowed into is decided here, from a verified JWT —
    // never from a client-supplied "isAdmin" flag, which anyone could send.
    socket.on("join", ({ token }) => {
      if (!token || !process.env.JWT_SECRET) return;
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.join(`user:${payload.userId}`);
        if (payload.role === "admin") socket.join("admin-room");
      } catch {
        // Invalid or expired token: join no rooms, emit nothing further.
      }
    });
  });

  // Make io reachable from API routes via a global, since Next.js API
  // routes don't share process state with this file by default.
  global.__campuspulse_io = io;

  httpServer.listen(port, () => {
    console.log(`> CampusPulse ready on http://localhost:${port}`);
  });
});
