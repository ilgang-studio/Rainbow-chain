import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
const socketUrl = (rawSocketUrl && rawSocketUrl.length > 0
  ? rawSocketUrl
  : "http://localhost:3001").replace(/\/+$/, "");

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 3000,
});
