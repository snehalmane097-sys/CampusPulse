"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

// One shared socket connection per browser tab, reused across components.
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: "/api/socket", withCredentials: true });
  }
  return socket;
}
export function disconnectSocket() { socket?.disconnect(); socket?.removeAllListeners(); socket = null; }
