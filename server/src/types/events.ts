import type { PublicRoomPlayer } from "../models/room.js";

export interface QueueJoinPayload {
  mode: "casual";
  nickname: string;
  guestId: string;
}

export interface RoomReadyPayload {
  roomId: string;
}

export interface OpponentPayload {
  guestId: string;
  nickname: string;
}

export interface QueueJoinedPayload {
  joinedAt: number;
}

export interface QueueTickPayload {
  elapsed: number;
}

export interface QueueCancelledPayload {}

export interface MatchFoundPayload {
  roomId: string;
  opponent: OpponentPayload;
  isBot: false;
}

export interface MatchAiFallbackPayload {
  roomId: string;
  opponent: OpponentPayload;
  isBot: true;
}

export interface RoomStartPayload {
  roomId: string;
  seed: number;
  players: PublicRoomPlayer[];
}

export interface ErrorPayload {
  message: string;
}

export interface ClientToServerEvents {
  "queue:join": (payload: QueueJoinPayload) => void;
  "queue:cancel": () => void;
  "room:ready": (payload: RoomReadyPayload) => void;
}

export interface ServerToClientEvents {
  "queue:joined": (payload: QueueJoinedPayload) => void;
  "queue:tick": (payload: QueueTickPayload) => void;
  "queue:cancelled": (payload: QueueCancelledPayload) => void;
  "match:found": (payload: MatchFoundPayload) => void;
  "match:ai_fallback": (payload: MatchAiFallbackPayload) => void;
  "room:start": (payload: RoomStartPayload) => void;
  "error": (payload: ErrorPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  guestId?: string;
}
