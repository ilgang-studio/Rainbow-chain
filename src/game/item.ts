// 아이템 시스템: 먹으면 체인 발동권 획득
// 각 아레나에 1개씩 생성, 획득 후 일정 시간 뒤 재생성

import type { Arena } from "./arena";

export interface Item {
  x: number;
  y: number;
  size: number;
  arenaIdx: 0 | 1;
  active: boolean;
  respawnTimer: number;
}

const ITEM_SIZE     = 13;
const RESPAWN_DELAY = 6.0;  // 획득 후 재생성까지 대기 시간 (초)
const ITEM_COLOR    = "#00ffcc";

function randomPos(arena: Arena): { x: number; y: number } {
  const pad = Math.min(arena.w, arena.h) * 0.18;
  return {
    x: arena.x + pad + Math.random() * (arena.w - pad * 2),
    y: arena.y + pad + Math.random() * (arena.h - pad * 2),
  };
}

export function createItems(arenas: [Arena, Arena]): [Item, Item] {
  return arenas.map((arena, i) => {
    const { x, y } = randomPos(arena);
    return { x, y, size: ITEM_SIZE, arenaIdx: i as 0 | 1, active: true, respawnTimer: 0 };
  }) as [Item, Item];
}

export function resetItems(items: [Item, Item], arenas: [Arena, Arena]): void {
  for (let i = 0; i < 2; i++) {
    const pos = randomPos(arenas[i]);
    items[i].x = pos.x;
    items[i].y = pos.y;
    items[i].active = true;
    items[i].respawnTimer = 0;
  }
}

// 획득 시도: 닿으면 true 반환 + 아이템 비활성화
export function tryPickup(item: Item, player: { x: number; y: number; radius: number }): boolean {
  if (!item.active) return false;
  const dx = player.x - item.x;
  const dy = player.y - item.y;
  if (Math.sqrt(dx * dx + dy * dy) < player.radius + item.size * 0.6) {
    item.active = false;
    item.respawnTimer = RESPAWN_DELAY;
    return true;
  }
  return false;
}

export function updateItems(items: [Item, Item], dt: number, arenas: [Arena, Arena]): void {
  for (let i = 0; i < 2; i++) {
    if (items[i].active) continue;
    items[i].respawnTimer -= dt;
    if (items[i].respawnTimer <= 0) {
      const pos = randomPos(arenas[i]);
      items[i].x = pos.x;
      items[i].y = pos.y;
      items[i].active = true;
    }
  }
}

export function drawItems(ctx: CanvasRenderingContext2D, items: [Item, Item]): void {
  const t = Date.now() / 1000;
  const pulse = 0.6 + 0.4 * Math.sin(t * 2.8);

  for (const item of items) {
    if (!item.active) continue;
    const s = item.size;

    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(t * 0.9);  // 천천히 회전
    ctx.shadowColor = ITEM_COLOR;
    ctx.shadowBlur  = 20 * pulse;
    ctx.fillStyle   = ITEM_COLOR;
    ctx.globalAlpha = 0.82 + 0.18 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
}
