// 각 플레이어의 플레이 공간 (사각형 아레나)

export interface Arena {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 두 아레나를 캔버스 중앙에 나란히 배치
export function createArenas(cw: number, ch: number, mode: "casual" | "practice" | "double" = "casual"): [Arena, Arena] {
  if (mode === "practice") {
    const size = Math.min(cw * 0.6, ch * 0.76);
    const x = (cw - size) / 2;
    const y = (ch - size) / 2;
    return [
      { x, y, w: size, h: size },
      { x: cw + size * 2, y: -size * 2, w: size, h: size },
    ];
  }

  const gap  = cw * 0.06;
  const size = Math.min((cw - gap) / 2 * 0.82, ch * 0.76);
  const y    = (ch - size) / 2;
  const leftX  = cw / 2 - gap / 2 - size;
  const rightX = cw / 2 + gap / 2;

  return [
    { x: leftX,  y, w: size, h: size },
    { x: rightX, y, w: size, h: size },
  ];
}

export function drawArena(ctx: CanvasRenderingContext2D, arena: Arena): void {
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 8;
  ctx.strokeRect(arena.x, arena.y, arena.w, arena.h);
  ctx.restore();
}
