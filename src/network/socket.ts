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

export async function prepareSocketAuth(guestId: string, nickname: string): Promise<void> {
  const response = await fetch(`${socketUrl}/auth/socket-guest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ guestId, nickname }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string" && data.message.trim()
        ? data.message
        : "Failed to prepare socket authentication.",
    );
  }

  if (typeof data?.token !== "string" || !data.token.trim()) {
    throw new Error("Socket auth token was not returned by the server.");
  }

  socket.auth = { token: data.token.trim() };
}
