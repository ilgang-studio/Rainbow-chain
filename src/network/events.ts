export interface PublicRoomPlayer {
  guestId: string;
  nickname: string;
  isBot: boolean;
}

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

export type QueueCancelledPayload = Record<string, never>;

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

export interface PlayerMovePayload {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

export interface GameOverPayload {
  winnerGuestId: string;
}

export interface RoomEndPayload {
  winnerGuestId: string;
}

export interface RematchRequestPayload  { roomId: string; }
export interface RematchCancelPayload   { roomId: string; }
export interface RematchWaitingPayload  { roomId: string; }
export interface RematchAcceptedPayload { roomId: string; seed: number; players: PublicRoomPlayer[]; }
export type RematchTimeoutPayload = Record<string, never>;
export type OpponentLeftPayload   = Record<string, never>;

export interface ClientToServerEvents {
  "queue:join":       (payload: QueueJoinPayload) => void;
  "queue:cancel":     () => void;
  "room:ready":       (payload: RoomReadyPayload) => void;
  "player:move":      (payload: PlayerMovePayload) => void;
  "game:over":        (payload: GameOverPayload) => void;
  "rematch:request":  (payload: RematchRequestPayload) => void;
  "rematch:cancel":   (payload: RematchCancelPayload) => void;
}

export interface ServerToClientEvents {
  "queue:joined":     (payload: QueueJoinedPayload) => void;
  "queue:tick":       (payload: QueueTickPayload) => void;
  "queue:cancelled":  (payload: QueueCancelledPayload) => void;
  "match:found":      (payload: MatchFoundPayload) => void;
  "match:ai_fallback":(payload: MatchAiFallbackPayload) => void;
  "room:start":       (payload: RoomStartPayload) => void;
  "player:moved":     (payload: PlayerMovePayload) => void;
  "room:end":         (payload: RoomEndPayload) => void;
  "rematch:waiting":  (payload: RematchWaitingPayload) => void;
  "rematch:accepted": (payload: RematchAcceptedPayload) => void;
  "rematch:timeout":  (payload: RematchTimeoutPayload) => void;
  "opponent:left":    (payload: OpponentLeftPayload) => void;
  "error":            (payload: ErrorPayload) => void;
}
