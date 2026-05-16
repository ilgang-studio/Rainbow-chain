import type { Player } from "./player";
import { updatePlayer, drawPlayer } from "./player";
import { isKeyDown } from "./input";
import type { Arena } from "./arena";
import { drawArena } from "./arena";
import { getRandomEncounter, type EncounterConfig } from "./encounter";
import { updateWarnings, drawWarnings, getActiveChains, resetWarnings, fireChain, CHAIN_TYPE_IDS, CHAIN_CONFIGS, getPhaseCycleVisual } from "./warning/index";
import { createItems, updateItemsWithRate, drawItems, tryPickup } from "./item";
import { drawFPS, drawTimer, drawGameOver, drawChainRing, drawEncounterIntro } from "./hud";
import { createArenaAi, updateArenaAi } from "./ai";
import { rng } from "./rng";
import type {
  BattleItemSnapshot,
  BattlePlayerSnapshot,
  BattleStatePayload,
  ChainSpawnPayload,
  ChainWarningPayload,
  ItemPickedPayload,
  ItemSpawnedPayload,
  PlayerStatePayload,
} from "../network/events";

const MAX_DT = 1 / 30;
const AUTHORITATIVE_ITEM_SIZE = 13;

interface OnlineChainEffect {
  chainId: string;
  ownerGuestId: string;
  chainType: string;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  phase: "warning" | "active";
  removeAt: number;
}

export interface OnlineGameOptions {
  localIdx: 0 | 1;
  myGuestId: string;
  opponentGuestId: string;
  emit: (ev: string, data: unknown) => void;
  on: (ev: string, fn: (data: unknown) => void) => void;
  off: (ev: string, fn: (data: unknown) => void) => void;
}

export function startGameLoop(
  canvas: HTMLCanvasElement,
  players: [Player, Player],
  arenas: [Arena, Arena],
  options?: {
    enableAi?: boolean;
    practiceMode?: boolean;
    onChainLaunch?: () => void;
    onRestartRequest?: () => void;
    online?: OnlineGameOptions;
  },
  onGameOverChange?: (isGameOver: boolean) => void,
): () => void {
  const ctx   = canvas.getContext("2d")!;
  resetWarnings();
  let rafId   = 0;
  let lastTime = performance.now();
  let isGameOver  = false;
  let deadIdx: 0 | 1 | null = null;
  let gameTime = 0;
  const online = options?.online;
  const enableAi = options?.enableAi ?? !online;
  const useServerBattle = Boolean(online && !enableAi);
  const practiceMode = options?.practiceMode ?? false;
  const arenaCount = practiceMode ? 1 : 2;
  const playerCount = practiceMode ? 1 : 2;
  const currentEncounter: EncounterConfig | null = useServerBattle ? null : getRandomEncounter();
  let encounterIntroTimer = 3;
  let latestBattleState: BattleStatePayload | null = null;
  let authoritativeItem: BattleItemSnapshot | null = null;
  const onlineChainEffects: OnlineChainEffect[] = [];
  const requestedItemIds = new Set<string>();
  let awaitingChainResolution = false;

  // 온라인 모드: 상대 최신 위치를 매 tick 반영
  let opponentX = players[online ? (1 - online.localIdx) as 0|1 : 1].x;
  let opponentY = players[online ? (1 - online.localIdx) as 0|1 : 1].y;

  const handlePlayerMoved = (data: unknown) => {
    const { x, y } = data as { x: number; y: number };
    opponentX = x;
    opponentY = y;
  };
  const handleRoomEnd = (data: unknown) => {
    const { winnerGuestId } = data as { winnerGuestId: string };
    if (isGameOver) return;
    isGameOver = true;
    deadIdx = winnerGuestId === online?.myGuestId
      ? (1 - online.localIdx) as 0 | 1  // 내가 이김 → 상대(deadIdx)가 죽음
      : online!.localIdx;                // 상대가 이김 → 내가(deadIdx) 죽음
    onGameOverChange?.(true);
  };

  const handleBattleState = (data: unknown) => {
    latestBattleState = data as BattleStatePayload;
    authoritativeItem = latestBattleState.item;
    if (online) {
      const mySnapshot = latestBattleState.players.find((player) => player.guestId === online.myGuestId);
      const opponentSnapshot = latestBattleState.players.find((player) => player.guestId === online.opponentGuestId);
      if (mySnapshot) {
        players[online.localIdx].hasChain = mySnapshot.heldChainType != null;
        players[online.localIdx].chainType = mySnapshot.heldChainType ?? "normal";
        if (mySnapshot.heldChainType == null) awaitingChainResolution = false;
      }
      if (opponentSnapshot) {
        const oppIdx = (1 - online.localIdx) as 0 | 1;
        players[oppIdx].hasChain = opponentSnapshot.heldChainType != null;
        players[oppIdx].chainType = opponentSnapshot.heldChainType ?? "normal";
        opponentX = opponentSnapshot.x;
        opponentY = opponentSnapshot.y;
      }
    }
    if (!latestBattleState.item?.active) {
      requestedItemIds.clear();
    }
  };

  const handlePlayerState = (data: unknown) => {
    if (!online || !latestBattleState) return;
    const payload = data as PlayerStatePayload;
    const snapshots = latestBattleState.players;
    const snapshot = snapshots.find((player) => player.guestId === online.opponentGuestId);
    if (!snapshot) return;
    snapshot.x = payload.x;
    snapshot.y = payload.y;
    snapshot.hp = payload.hp;
    snapshot.score = payload.score;
    opponentX = payload.x;
    opponentY = payload.y;
  };

  const handleItemSpawned = (data: unknown) => {
    const payload = data as ItemSpawnedPayload;
    authoritativeItem = {
      itemId: payload.itemId,
      chainType: payload.chainType,
      x: payload.x,
      y: payload.y,
      active: true,
      respawnAt: null,
      pickedByGuestId: null,
    };
    requestedItemIds.delete(payload.itemId);
  };

  const handleItemPicked = (data: unknown) => {
    const payload = data as ItemPickedPayload;
    authoritativeItem = authoritativeItem && authoritativeItem.itemId === payload.itemId
      ? {
          ...authoritativeItem,
          active: false,
          pickedByGuestId: payload.pickedByGuestId,
          respawnAt: payload.respawnAt,
        }
      : {
          itemId: payload.itemId,
          chainType: payload.chainType,
          x: authoritativeItem?.x ?? 0,
          y: authoritativeItem?.y ?? 0,
          active: false,
          respawnAt: payload.respawnAt,
          pickedByGuestId: payload.pickedByGuestId,
        };
    requestedItemIds.delete(payload.itemId);
    if (online && payload.pickedByGuestId === online.myGuestId) {
      players[online.localIdx].hasChain = true;
      players[online.localIdx].chainType = payload.chainType;
      awaitingChainResolution = false;
    }
  };

  const upsertChainEffect = (
    payload: ChainWarningPayload | ChainSpawnPayload,
    phase: "warning" | "active",
  ) => {
    const removeAt = phase === "warning"
      ? payload.fireAt + 150
      : ("firedAt" in payload ? payload.firedAt : payload.fireAt) + 2200;
    const existing = onlineChainEffects.find((effect) => effect.chainId === payload.chainId);
    if (existing) {
      existing.ownerGuestId = payload.ownerGuestId;
      existing.chainType = payload.chainType;
      existing.originX = payload.originX;
      existing.originY = payload.originY;
      existing.dx = payload.dx;
      existing.dy = payload.dy;
      existing.phase = phase;
      existing.removeAt = removeAt;
      return;
    }
    onlineChainEffects.push({
      chainId: payload.chainId,
      ownerGuestId: payload.ownerGuestId,
      chainType: payload.chainType,
      originX: payload.originX,
      originY: payload.originY,
      dx: payload.dx,
      dy: payload.dy,
      phase,
      removeAt,
    });
  };

  const handleChainWarning = (data: unknown) => {
    upsertChainEffect(data as ChainWarningPayload, "warning");
  };

  const handleChainSpawned = (data: unknown) => {
    upsertChainEffect(data as ChainSpawnPayload, "active");
  };

  if (online) {
    online.on("player:moved", handlePlayerMoved);
    online.on("room:end", handleRoomEnd);
    online.on("battle:state", handleBattleState);
    online.on("player:state", handlePlayerState);
    online.on("item:spawned", handleItemSpawned);
    online.on("item:picked", handleItemPicked);
    online.on("chain:warning", handleChainWarning);
    online.on("chain:spawned", handleChainSpawned);
  }

  // FPS 계산: 1초 단위 샘플링
  let fpsDisplay  = 0;
  let fpsFrames   = 0;
  let fpsAccum    = 0;

  function pointToSegmentDistance(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 0.0001) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    return Math.hypot(px - cx, py - cy);
  }

  function getPlayerStateSnapshot(guestId: string): BattlePlayerSnapshot | null {
    return latestBattleState?.players.find((player) => player.guestId === guestId) ?? null;
  }

  function getAimVector(player: Player, fallbackX: number, fallbackY: number): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;
    if (isKeyDown(player.keys.left)) dx -= 1;
    if (isKeyDown(player.keys.right)) dx += 1;
    if (isKeyDown(player.keys.up)) dy -= 1;
    if (isKeyDown(player.keys.down)) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      return { dx: dx / len, dy: dy / len };
    }
    const fallbackDx = fallbackX - player.x;
    const fallbackDy = fallbackY - player.y;
    const len = Math.hypot(fallbackDx, fallbackDy);
    if (len <= 0.0001) return { dx: 1, dy: 0 };
    return { dx: fallbackDx / len, dy: fallbackDy / len };
  }

  function drawAuthoritativeItem(
    ctx: CanvasRenderingContext2D,
    item: BattleItemSnapshot | null,
  ): void {
    if (!item?.active) return;
    drawItems(ctx, [{
      x: item.x,
      y: item.y,
      size: AUTHORITATIVE_ITEM_SIZE,
      arenaIdx: 0,
      active: true,
      respawnTimer: 0,
    }]);
  }

  function getLineRectSegment(
    originX: number,
    originY: number,
    dx: number,
    dy: number,
    arena: Arena,
  ): { x1: number; y1: number; x2: number; y2: number } | null {
    const ts: number[] = [];
    if (Math.abs(dx) > 0.0001) {
      const leftT = (arena.x - originX) / dx;
      const rightT = (arena.x + arena.w - originX) / dx;
      const leftY = originY + leftT * dy;
      const rightY = originY + rightT * dy;
      if (leftY >= arena.y && leftY <= arena.y + arena.h) ts.push(leftT);
      if (rightY >= arena.y && rightY <= arena.y + arena.h) ts.push(rightT);
    }
    if (Math.abs(dy) > 0.0001) {
      const topT = (arena.y - originY) / dy;
      const bottomT = (arena.y + arena.h - originY) / dy;
      const topX = originX + topT * dx;
      const bottomX = originX + bottomT * dx;
      if (topX >= arena.x && topX <= arena.x + arena.w) ts.push(topT);
      if (bottomX >= arena.x && bottomX <= arena.x + arena.w) ts.push(bottomT);
    }
    if (ts.length < 2) return null;
    ts.sort((a, b) => a - b);
    const t1 = ts[0];
    const t2 = ts[ts.length - 1];
    return {
      x1: originX + dx * t1,
      y1: originY + dy * t1,
      x2: originX + dx * t2,
      y2: originY + dy * t2,
    };
  }

  function drawServerChainEffect(
    ctx: CanvasRenderingContext2D,
    arena: Arena,
    effect: OnlineChainEffect,
  ): void {
    const cfg = CHAIN_CONFIGS[effect.chainType] ?? CHAIN_CONFIGS.normal;
    const len = Math.hypot(effect.dx, effect.dy);
    if (len <= 0.0001) return;
    const dx = effect.dx / len;
    const dy = effect.dy / len;
    const segment = getLineRectSegment(effect.originX, effect.originY, dx, dy, arena);
    if (!segment) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(arena.x, arena.y, arena.w, arena.h);
    ctx.clip();

    if (effect.phase === "warning") {
      const bandHalf = cfg.bandHalfWidth ?? 24;
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = cfg.warningColor;
      ctx.lineWidth = bandHalf * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();

      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();
    } else {
      const ringRadius = cfg.linkRadius ?? 3;
      const step = Math.max(13, ringRadius * 4);
      const dist = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = cfg.linkColor;
      ctx.lineWidth = ringRadius * 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = cfg.linkColor;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "butt";
      ctx.beginPath();
      for (let traveled = 0; traveled <= dist; traveled += step) {
        const px = segment.x1 + dx * traveled;
        const py = segment.y1 + dy * traveled;
        ctx.moveTo(px + ringRadius, py);
        ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  const items = createItems(arenas);
  const arenaAi = createArenaAi();

  function triggerGameOver(nextDeadIdx: 0 | 1): void {
    if (isGameOver) return;
    isGameOver = true;
    deadIdx = nextDeadIdx;
    onGameOverChange?.(true);
    if (online) {
      const winnerGuestId = nextDeadIdx === online.localIdx
        ? online.opponentGuestId
        : online.myGuestId;
      online.emit("game:over", { winnerGuestId });
    }
  }

  function checkCollisions(): void {
    const CHAIN_LINK_R = 3; // warning.ts LINK_R와 동일
    for (const chain of getActiveChains()) {
      if (practiceMode && chain.arenaIdx === 1) continue;
      const p          = players[chain.arenaIdx];
      const arena      = arenas[chain.arenaIdx];
      const isVert     = chain.orientation === "vertical";
      const fullLen    = isVert ? arena.h : arena.w;
      const base       = isVert ? arena.y : arena.x;
      const adjBase    = base + CHAIN_LINK_R;
      const adjMax     = base + fullLen - CHAIN_LINK_R;

      if (chain.chainType === "phase") {
        const cfg = CHAIN_CONFIGS[chain.chainType] ?? CHAIN_CONFIGS["normal"];
        if (!getPhaseCycleVisual(chain.elapsed, cfg).solid) continue;
      }

      if (chain.mirrorTurnUp) {
        const hitRadius = p.radius + chain.chainRadius;
        const left = arena.x + CHAIN_LINK_R;
        const right = arena.x + arena.w - CHAIN_LINK_R;
        const drawn2 = Math.min(
          chain.mirrorTurnLength,
          chain.mirrorTurnLength * Math.min(1, chain.elapsed / ((CHAIN_CONFIGS[chain.chainType] ?? CHAIN_CONFIGS["normal"]).extendDuration)),
        );

        if (
          Math.abs(p.y - chain.centerPos) < hitRadius
          && p.x + p.radius >= left
          && p.x - p.radius <= right
        ) {
          triggerGameOver(chain.arenaIdx);
          return;
        }

        if (
          drawn2 > 0
          && Math.abs(p.x - chain.mirrorTurnX) < hitRadius
          && p.y + p.radius >= chain.centerPos - drawn2
          && p.y - p.radius <= chain.centerPos
        ) {
          triggerGameOver(chain.arenaIdx);
          return;
        }
        continue;
      }

      if (chain.chainType === "tracking") {
        const cfg = CHAIN_CONFIGS[chain.chainType] ?? CHAIN_CONFIGS["normal"];
        const hitRadius = p.radius + (cfg.chainWidth ?? 16) * 0.5;
        const points = chain.trackPoints;
        if (points.length === 1) {
          if (Math.hypot(p.x - points[0].x, p.y - points[0].y) <= hitRadius) {
            triggerGameOver(chain.arenaIdx);
            return;
          }
        } else {
          for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            if (pointToSegmentDistance(p.x, p.y, a.x, a.y, b.x, b.y) <= hitRadius) {
              triggerGameOver(chain.arenaIdx);
              return;
            }
          }
        }
        continue;
      }

      // Turn 체인: L자형 두 구간 별도 판정
      if (chain.chainType === "turn") {
        const drawn1 = Math.min(chain.drawLength, chain.seg1Len);
        const drawn2 = Math.max(0, chain.drawLength - chain.seg1Len);

        // Seg1: primary axis at centerPos
        const dist1 = isVert ? Math.abs(p.x - chain.centerPos) : Math.abs(p.y - chain.centerPos);
        if (dist1 < p.radius && drawn1 > 0) {
          const s1Start = chain.direction === 1 ? adjBase : adjMax - drawn1;
          const s1End   = chain.direction === 1 ? adjBase + drawn1 : adjMax;
          const along1  = isVert ? p.y : p.x;
          if (along1 + p.radius >= s1Start && along1 - p.radius <= s1End) {
            triggerGameOver(chain.arenaIdx);
            return;
          }
        }

        // Seg2: perpendicular at turnPoint
        if (drawn2 > 0) {
          const dist2 = isVert ? Math.abs(p.y - chain.turnPoint) : Math.abs(p.x - chain.turnPoint);
          if (dist2 < p.radius) {
            const s2Start = chain.turnDir === 1 ? chain.centerPos : chain.centerPos - drawn2;
            const s2End   = chain.turnDir === 1 ? chain.centerPos + drawn2 : chain.centerPos;
            const along2  = isVert ? p.x : p.y;
            if (along2 + p.radius >= s2Start && along2 - p.radius <= s2End) {
              triggerGameOver(chain.arenaIdx);
              return;
            }
          }
        }
        continue;
      }

      // 직선 체인: 중심선 거리 판정
      const dist = isVert
        ? Math.abs(p.x - chain.centerPos)
        : Math.abs(p.y - chain.centerPos);
      if (dist >= p.radius + chain.chainRadius) continue;

      // phase별 실제 충돌 구간 (adjBase~adjMax 내부 기준)
      let segStart: number;
      let segEnd:   number;
      if (chain.phase === "extending") {
        segStart = chain.direction === 1 ? adjBase : adjMax - chain.drawLength;
        segEnd   = segStart + chain.drawLength;
      } else if (chain.phase === "active") {
        segStart = adjBase;
        segEnd   = adjMax;
      } else { // exiting — 아레나 밖으로 나간 부분 제외
        if (chain.direction === 1) {
          segStart = adjBase + chain.exitOffset;
          segEnd   = adjMax;
        } else {
          segStart = adjBase;
          segEnd   = adjMax - chain.exitOffset;
        }
      }

      const along = isVert ? p.y : p.x;
      if (along + p.radius < segStart || along - p.radius > segEnd) continue;

      triggerGameOver(chain.arenaIdx);
      return;
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (isGameOver) return;

    if (useServerBattle && online) {
      const localPlayer = players[online.localIdx];
      if (
        e.key === localPlayer.useKey
        && localPlayer.hasChain
        && !awaitingChainResolution
      ) {
        const aim = getAimVector(localPlayer, opponentX, opponentY);
        awaitingChainResolution = true;
        online.emit("chain:cast", { dx: aim.dx, dy: aim.dy, t: Date.now() });
      }
      return;
    }

    // 체인 발동: 해당 플레이어가 체인 보유 중일 때만
    for (let i = 0; i < playerCount; i++) {
      if (e.key === players[i].useKey && players[i].hasChain) {
        players[i].hasChain = false;
        fireChain((practiceMode ? i : (1 - i)) as 0 | 1, arenas, players[i].chainType, currentEncounter);
      }
    }
  };
  window.addEventListener("keydown", onKey);

  function tick(now: number) {
    const raw = (now - lastTime) / 1000;
    const dt  = Math.min(raw, MAX_DT);
    lastTime  = now;

    // FPS: 1초마다 갱신
    fpsFrames++;
    fpsAccum += raw;
    if (fpsAccum >= 1.0) {
      fpsDisplay = Math.round(fpsFrames / fpsAccum);
      fpsFrames  = 0;
      fpsAccum   = 0;
    }

    // ── 배경 ────────────────────────────────
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── 아레나 테두리 ────────────────────────
    for (let i = 0; i < arenaCount; i++) drawArena(ctx, arenas[i]);

    if (!isGameOver) {
      gameTime += dt;
      if (!useServerBattle) {
        encounterIntroTimer = Math.max(0, encounterIntroTimer - dt);
      }

      // ── 아이템 업데이트 ────────────────────
      if (!useServerBattle) {
        updateItemsWithRate(
          items,
          dt,
          arenas,
          currentEncounter?.modifiers.itemRespawnRateMultiplier ?? 1,
        );
      }

      // ── 아이템 획득 판정 ───────────────────
      if (useServerBattle && online) {
        const localPlayer = players[online.localIdx];
        if (authoritativeItem?.active && !requestedItemIds.has(authoritativeItem.itemId)) {
          const dx = localPlayer.x - authoritativeItem.x;
          const dy = localPlayer.y - authoritativeItem.y;
          if (Math.sqrt(dx * dx + dy * dy) < localPlayer.radius + AUTHORITATIVE_ITEM_SIZE * 0.6) {
            requestedItemIds.add(authoritativeItem.itemId);
            online.emit("item:pickup", { itemId: authoritativeItem.itemId, t: Date.now() });
          }
        }
      } else {
        for (let i = 0; i < arenaCount; i++) {
          // 온라인: 자기 아레나 아이템만 직접 판정 (상대 아레나는 상대 클라이언트가 처리)
          if (online && i !== online.localIdx) continue;
          if (!players[i].hasChain && tryPickup(items[i], players[i])) {
            players[i].hasChain  = true;
            players[i].chainType = CHAIN_TYPE_IDS[Math.floor(rng() * CHAIN_TYPE_IDS.length)];
          }
        }
      }

      // ── 경고 / 사슬 업데이트 ───────────────
      if (!useServerBattle) {
        updateWarnings(dt, arenas, players, gameTime, {
          practiceMode,
          onChainLaunch: options?.onChainLaunch,
        }, currentEncounter);
      }

      for (let i = onlineChainEffects.length - 1; i >= 0; i--) {
        if (onlineChainEffects[i].removeAt <= Date.now()) {
          onlineChainEffects.splice(i, 1);
        }
      }

      // ── 플레이어 이동 ──────────────────────
      if (online) {
        // 온라인: 로컬 플레이어만 키보드로 이동; 상대는 수신 위치로 갱신
        updatePlayer(players[online.localIdx], dt, arenas[online.localIdx]);
        const oppIdx = (1 - online.localIdx) as 0 | 1;
        if (enableAi) {
          const aiUseChain = updateArenaAi(
            arenaAi,
            dt,
            players[oppIdx],
            players[online.localIdx],
            arenas[oppIdx],
            arenas[online.localIdx],
            items[oppIdx],
          );
          if (aiUseChain && players[oppIdx].hasChain) {
            players[oppIdx].hasChain = false;
            fireChain(online.localIdx, arenas, players[oppIdx].chainType, currentEncounter);
          }
        } else {
          players[oppIdx].x = opponentX;
          players[oppIdx].y = opponentY;
        }
        // 내 위치 전송
        const lp = players[online.localIdx];
        online.emit("player:move", { x: lp.x, y: lp.y, vx: 0, vy: 0, t: Date.now() });
        if (useServerBattle) {
          const mySnapshot = getPlayerStateSnapshot(online.myGuestId);
          online.emit("player:state", {
            x: lp.x,
            y: lp.y,
            hp: mySnapshot?.hp ?? 0,
            score: mySnapshot?.score ?? 0,
            t: Date.now(),
          });
        }
      } else {
        updatePlayer(players[0], dt, arenas[0]);
        if (enableAi) {
          const aiUseChain = updateArenaAi(arenaAi, dt, players[1], players[0], arenas[1], arenas[0], items[1]);
          if (aiUseChain && players[1].hasChain) {
            players[1].hasChain = false;
            fireChain(0, arenas, players[1].chainType, currentEncounter);
          }
        } else if (!practiceMode) {
          updatePlayer(players[1], dt, arenas[1]);
        }
      }

      // ── 충돌 판정 ──────────────────────────
      if (!useServerBattle) {
        checkCollisions();
      }
    }

    // ── 렌더링 ──────────────────────────────
    if (!useServerBattle) {
      drawWarnings(ctx, arenas);
      drawItems(ctx, practiceMode ? [items[0]] : items);
    } else {
      drawAuthoritativeItem(ctx, authoritativeItem);
      for (const effect of onlineChainEffects) {
        const arena = effect.originX < canvas.width / 2 ? arenas[0] : arenas[1];
        drawServerChainEffect(ctx, arena, effect);
      }
    }

    for (let i = 0; i < playerCount; i++) {
      drawPlayer(ctx, players[i]);
      if (players[i].hasChain) drawChainRing(ctx, players[i]);
    }

    // ── 타이머 + FPS ────────────────────────
    drawTimer(ctx, canvas.width, gameTime);
    drawFPS(ctx, fpsDisplay);
    if (!useServerBattle) {
      drawEncounterIntro(ctx, canvas.width, canvas.height, currentEncounter, encounterIntroTimer);
    }

    // ── 게임 오버 오버레이 ───────────────────
    if (isGameOver) drawGameOver(ctx, canvas.width, canvas.height, deadIdx!);

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKey);
    if (online) {
      online.off("player:moved", handlePlayerMoved);
      online.off("room:end", handleRoomEnd);
      online.off("battle:state", handleBattleState);
      online.off("player:state", handlePlayerState);
      online.off("item:spawned", handleItemSpawned);
      online.off("item:picked", handleItemPicked);
      online.off("chain:warning", handleChainWarning);
      online.off("chain:spawned", handleChainSpawned);
    }
  };
}
