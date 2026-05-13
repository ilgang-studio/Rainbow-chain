import type { Player } from "./player";
import { updatePlayer, drawPlayer } from "./player";
import type { Arena } from "./arena";
import { drawArena } from "./arena";
import { updateWarnings, drawWarnings, getActiveChains, resetWarnings, fireChain, CHAIN_TYPE_IDS, CHAIN_CONFIGS, getPhaseCycleVisual } from "./warning/index";
import { createItems, updateItems, drawItems, tryPickup, resetItems } from "./item";
import { drawFPS, drawTimer, drawGameOver, drawChainRing } from "./hud";

const MAX_DT = 1 / 30;

export function startGameLoop(
  canvas: HTMLCanvasElement,
  players: [Player, Player],
  arenas: [Arena, Arena],
): () => void {
  const ctx   = canvas.getContext("2d")!;
  let rafId   = 0;
  let lastTime = performance.now();
  let isGameOver  = false;
  let deadIdx: 0 | 1 | null = null;
  let gameTime = 0;

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

  const items = createItems(arenas);

  function resetGame(): void {
    for (let i = 0; i < 2; i++) {
      players[i].x         = arenas[i].x + arenas[i].w / 2;
      players[i].y         = arenas[i].y + arenas[i].h / 2;
      players[i].hasChain  = false;
      players[i].chainType = "normal";
    }
    resetWarnings();
    resetItems(items, arenas);
    isGameOver = false;
    deadIdx    = null;
    gameTime   = 0;
  }

  function checkCollisions(): void {
    const CHAIN_LINK_R = 3; // warning.ts LINK_R와 동일
    for (const chain of getActiveChains()) {
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

      if (chain.chainType === "tracking") {
        const cfg = CHAIN_CONFIGS[chain.chainType] ?? CHAIN_CONFIGS["normal"];
        const hitRadius = p.radius + (cfg.chainWidth ?? 16) * 0.5;
        const points = chain.trackPoints;
        if (points.length === 1) {
          if (Math.hypot(p.x - points[0].x, p.y - points[0].y) <= hitRadius) {
            isGameOver = true; deadIdx = chain.arenaIdx; return;
          }
        } else {
          for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            if (pointToSegmentDistance(p.x, p.y, a.x, a.y, b.x, b.y) <= hitRadius) {
              isGameOver = true; deadIdx = chain.arenaIdx; return;
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
            isGameOver = true; deadIdx = chain.arenaIdx; return;
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
              isGameOver = true; deadIdx = chain.arenaIdx; return;
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

      isGameOver = true;
      deadIdx    = chain.arenaIdx;
      return;
    }
  }

  const onKey = (e: KeyboardEvent) => {
    // 재시작
    if (e.key === "r" || e.key === "R") {
      if (isGameOver) resetGame();
      return;
    }
    if (isGameOver) return;

    // 체인 발동: 해당 플레이어가 체인 보유 중일 때만
    for (let i = 0; i < 2; i++) {
      if (e.key === players[i].useKey && players[i].hasChain) {
        players[i].hasChain = false;
        fireChain((1 - i) as 0 | 1, arenas, players[i].chainType);  // 상대 아레나에 발동
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
    for (const arena of arenas) drawArena(ctx, arena);

    if (!isGameOver) {
      gameTime += dt;

      // ── 아이템 업데이트 ────────────────────
      updateItems(items, dt, arenas);

      // ── 아이템 획득 판정 ───────────────────
      for (let i = 0; i < 2; i++) {
        if (!players[i].hasChain && tryPickup(items[i], players[i])) {
          players[i].hasChain  = true;
          players[i].chainType = CHAIN_TYPE_IDS[Math.floor(Math.random() * CHAIN_TYPE_IDS.length)];
        }
      }

      // ── 경고 / 사슬 업데이트 ───────────────
      updateWarnings(dt, arenas, players, gameTime);

      // ── 플레이어 이동 ──────────────────────
      updatePlayer(players[0], dt, arenas[0]);
      updatePlayer(players[1], dt, arenas[1]);

      // ── 충돌 판정 ──────────────────────────
      checkCollisions();
    }

    // ── 렌더링 ──────────────────────────────
    drawWarnings(ctx, arenas);
    drawItems(ctx, items);

    for (let i = 0; i < 2; i++) {
      drawPlayer(ctx, players[i]);
      if (players[i].hasChain) drawChainRing(ctx, players[i]);
    }

    // ── 타이머 + FPS ────────────────────────
    drawTimer(ctx, canvas.width, gameTime);
    drawFPS(ctx, fpsDisplay);

    // ── 게임 오버 오버레이 ───────────────────
    if (isGameOver) drawGameOver(ctx, canvas.width, canvas.height, deadIdx!);

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKey);
  };
}
