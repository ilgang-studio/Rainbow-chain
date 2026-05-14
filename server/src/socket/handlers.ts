import type { Socket } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/events.js";
import type { MatchmakingService } from "../services/matchmaking.js";

type ServerSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerSocketHandlers(
  socket: ServerSocket,
  matchmaking: MatchmakingService,
): void {
  socket.on("queue:join", (payload) => {
    matchmaking.joinQueue(socket, payload);
  });

  socket.on("queue:cancel", () => {
    matchmaking.cancelQueue(socket);
  });

  socket.on("room:ready", ({ roomId }) => {
    matchmaking.markReady(socket, roomId);
  });

  socket.on("disconnect", () => {
    matchmaking.disconnect(socket);
  });
}
