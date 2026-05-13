import type { Arena } from "../arena";
import {
  BAND_HALF_WIDTH,
  CHAIN_CONFIGS,
  FLASH_DURATION,
  LINK_R,
  WARNING_DURATION,
  type TrackPoint,
  type Zone,
} from "./shared";
import { zones } from "./state";

function sampleTrackingPoints(points: TrackPoint[], spacing: number): TrackPoint[] {
  if (points.length <= 1) return points.slice();

  const sampled: TrackPoint[] = [{ x: points[0].x, y: points[0].y }];
  let lastSample = points[0];
  let carry = 0;

  for (let i = 1; i < points.length; i++) {
    let start = { x: points[i - 1].x, y: points[i - 1].y };
    const end = points[i];
    let segDx = end.x - start.x;
    let segDy = end.y - start.y;
    let segLen = Math.sqrt(segDx * segDx + segDy * segDy);
    if (segLen <= 0.0001) continue;

    while (carry + segLen >= spacing) {
      const t = (spacing - carry) / segLen;
      const sample = {
        x: start.x + segDx * t,
        y: start.y + segDy * t,
      };
      sampled.push(sample);
      lastSample = sample;
      start = sample;
      segDx = end.x - start.x;
      segDy = end.y - start.y;
      segLen = Math.sqrt(segDx * segDx + segDy * segDy);
      carry = 0;
      if (segLen <= 0.0001) break;
    }

    carry += segLen;
  }

  const lastPoint = points[points.length - 1];
  if (lastSample.x !== lastPoint.x || lastSample.y !== lastPoint.y) {
    sampled.push({ x: lastPoint.x, y: lastPoint.y });
  }
  return sampled;
}

function drawBand(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const isVert = z.orientation === "vertical";
  const bHalf = cfg.bandHalfWidth ?? BAND_HALF_WIDTH;

  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle = cfg.warningColor;
  if (isVert) {
    ctx.fillRect(z.centerPos - bHalf, arena.y, bHalf * 2, arena.h);
  } else {
    ctx.fillRect(arena.x, z.centerPos - bHalf, arena.w, bHalf * 2);
  }

  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = cfg.warningColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (isVert) {
    ctx.moveTo(z.centerPos, arena.y);
    ctx.lineTo(z.centerPos, arena.y + arena.h);
  } else {
    ctx.moveTo(arena.x, z.centerPos);
    ctx.lineTo(arena.x + arena.w, z.centerPos);
  }
  ctx.stroke();
}

function drawTurnArrow(ctx: CanvasRenderingContext2D, z: Zone, alpha: number): void {
  const isVert = z.orientation === "vertical";
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const ax = isVert ? z.centerPos : z.turnPoint;
  const ay = isVert ? z.turnPoint : z.centerPos;
  const dx = isVert ? z.turnDir : 0;
  const dy = isVert ? 0 : z.turnDir;
  const tip = 9;
  const back = 3;
  const half = 6;

  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = cfg.warningColor;
  ctx.beginPath();
  ctx.moveTo(ax + dx * tip, ay + dy * tip);
  ctx.lineTo(ax - dx * back - dy * half, ay - dy * back + dx * half);
  ctx.lineTo(ax - dx * back + dy * half, ay - dy * back - dx * half);
  ctx.closePath();
  ctx.fill();
}

function drawFakeWarning(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const isVert = z.orientation === "vertical";
  const pos = z.fakePos;

  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle = cfg.warningColor;
  if (isVert) ctx.fillRect(pos - BAND_HALF_WIDTH, arena.y, BAND_HALF_WIDTH * 2, arena.h);
  else ctx.fillRect(arena.x, pos - BAND_HALF_WIDTH, arena.w, BAND_HALF_WIDTH * 2);

  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = cfg.warningColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const seg = 18;
  if (isVert) {
    for (let y = arena.y; y < arena.y + arena.h; y += seg) {
      const gx = pos + (Math.random() < 0.3 ? (Math.random() - 0.5) * 7 : 0);
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, Math.min(y + seg, arena.y + arena.h));
    }
  } else {
    for (let x = arena.x; x < arena.x + arena.w; x += seg) {
      const gy = pos + (Math.random() < 0.3 ? (Math.random() - 0.5) * 7 : 0);
      ctx.moveTo(x, gy);
      ctx.lineTo(Math.min(x + seg, arena.x + arena.w), gy);
    }
  }
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.3;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const off = (Math.random() - 0.5) * BAND_HALF_WIDTH * 1.5;
    ctx.beginPath();
    if (isVert) {
      const y1 = arena.y + Math.random() * arena.h;
      ctx.moveTo(pos + off, y1);
      ctx.lineTo(pos + off, y1 + Math.random() * 28 + 6);
    } else {
      const x1 = arena.x + Math.random() * arena.w;
      ctx.moveTo(x1, pos + off);
      ctx.lineTo(x1 + Math.random() * 28 + 6, pos + off);
    }
    ctx.stroke();
  }
}

function drawChainLinks(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena): void {
  const isVert = z.orientation === "vertical";
  const fullLen = isVert ? arena.h : arena.w;
  const base = isVert ? arena.y : arena.x;
  const adjBase = base + LINK_R;
  const adjFullLen = fullLen - 2 * LINK_R;

  let chainStart: number;
  let chainLen: number;

  if (z.phase === "extending") {
    chainLen = z.drawLength;
    chainStart = z.direction === 1 ? adjBase : adjBase + adjFullLen - chainLen;
  } else if (z.phase === "active") {
    chainLen = adjFullLen;
    chainStart = adjBase;
  } else {
    chainLen = adjFullLen;
    chainStart = z.direction === 1 ? adjBase + z.exitOffset : adjBase - z.exitOffset;
  }

  if (chainLen <= 0) return;

  const step = 13;
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth = LINK_R * 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (isVert) {
    ctx.moveTo(z.centerPos, chainStart - LINK_R);
    ctx.lineTo(z.centerPos, chainStart + chainLen + LINK_R);
  } else {
    ctx.moveTo(chainStart - LINK_R, z.centerPos);
    ctx.lineTo(chainStart + chainLen + LINK_R, z.centerPos);
  }
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "butt";
  ctx.beginPath();
  let prevPos: number | null = null;
  for (let pos = chainStart; pos <= chainStart + chainLen; pos += step) {
    const cx = isVert ? z.centerPos : pos;
    const cy = isVert ? pos : z.centerPos;
    if (prevPos !== null) {
      if (isVert) {
        ctx.moveTo(z.centerPos, prevPos + LINK_R);
        ctx.lineTo(z.centerPos, cy - LINK_R);
      } else {
        ctx.moveTo(prevPos + LINK_R, z.centerPos);
        ctx.lineTo(cx - LINK_R, z.centerPos);
      }
    }
    ctx.moveTo(cx + LINK_R, cy);
    ctx.arc(cx, cy, LINK_R, 0, Math.PI * 2);
    prevPos = pos;
  }

  if (prevPos !== null) {
    if (isVert) {
      ctx.moveTo(z.centerPos, prevPos + LINK_R);
      ctx.lineTo(z.centerPos, chainStart + chainLen + LINK_R);
    } else {
      ctx.moveTo(prevPos + LINK_R, z.centerPos);
      ctx.lineTo(chainStart + chainLen + LINK_R, z.centerPos);
    }
  }
  ctx.stroke();
}

function drawGiantChainLinks(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena): void {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const isVert = z.orientation === "vertical";
  const fullLen = isVert ? arena.h : arena.w;
  const base = isVert ? arena.y : arena.x;
  const r = cfg.linkRadius ?? LINK_R;
  const adjBase = base + r;
  const adjFullLen = fullLen - 2 * r;

  let chainStart: number;
  let chainLen: number;

  if (z.phase === "extending") {
    chainLen = z.drawLength;
    chainStart = z.direction === 1 ? adjBase : adjBase + adjFullLen - chainLen;
  } else if (z.phase === "active") {
    chainLen = adjFullLen;
    chainStart = adjBase;
  } else {
    chainLen = adjFullLen;
    chainStart = z.direction === 1 ? adjBase + z.exitOffset : adjBase - z.exitOffset;
  }

  if (chainLen <= 0) return;

  const step = r * 4;
  const connectorWidth = r * 0.75;
  const positions: number[] = [];

  if (chainLen < r * 2.2) {
    positions.push(chainStart);
  } else {
    const gapCount = Math.max(1, Math.round(chainLen / step));
    const actualStep = chainLen / gapCount;
    for (let i = 0; i <= gapCount; i++) {
      positions.push(chainStart + actualStep * i);
    }
  }

  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth = r * 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  let prevGlowPos: number | null = null;
  for (const pos of positions) {
    if (prevGlowPos !== null) {
      if (isVert) {
        ctx.moveTo(z.centerPos, prevGlowPos + r);
        ctx.lineTo(z.centerPos, pos - r);
      } else {
        ctx.moveTo(prevGlowPos + r, z.centerPos);
        ctx.lineTo(pos - r, z.centerPos);
      }
    }
    prevGlowPos = pos;
  }
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth = connectorWidth;
  ctx.lineCap = "butt";
  ctx.beginPath();
  let prevPos: number | null = null;
  for (const pos of positions) {
    const cx = isVert ? z.centerPos : pos;
    const cy = isVert ? pos : z.centerPos;
    if (prevPos !== null) {
      if (isVert) {
        ctx.moveTo(z.centerPos, prevPos + r);
        ctx.lineTo(z.centerPos, cy - r);
      } else {
        ctx.moveTo(prevPos + r, z.centerPos);
        ctx.lineTo(cx - r, z.centerPos);
      }
    }
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    prevPos = pos;
  }
  ctx.stroke();
}

function drawTurnChainLinks(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena): void {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const isVert = z.orientation === "vertical";
  const fullLen = isVert ? arena.h : arena.w;
  const base = isVert ? arena.y : arena.x;
  const adjBase = base + LINK_R;
  const adjFullLen = fullLen - 2 * LINK_R;
  const drawn1 = Math.min(z.drawLength, z.seg1Len);
  const drawn2 = Math.max(0, z.drawLength - z.seg1Len);

  let exitAlpha = 1;
  if (z.phase === "exiting") {
    exitAlpha = Math.max(0, 1 - z.elapsed / cfg.exitDuration);
  }

  const seg1Origin = z.direction === 1 ? adjBase : adjBase + adjFullLen;
  const step = 13;

  ctx.globalAlpha = 0.18 * exitAlpha;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth = LINK_R * 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (drawn1 > 0) {
    if (isVert) {
      ctx.moveTo(z.centerPos, seg1Origin);
      ctx.lineTo(z.centerPos, seg1Origin + z.direction * drawn1);
    } else {
      ctx.moveTo(seg1Origin, z.centerPos);
      ctx.lineTo(seg1Origin + z.direction * drawn1, z.centerPos);
    }
  }
  if (drawn2 > 0) {
    if (isVert) {
      ctx.moveTo(z.centerPos, z.turnPoint);
      ctx.lineTo(z.centerPos + z.turnDir * drawn2, z.turnPoint);
    } else {
      ctx.moveTo(z.turnPoint, z.centerPos);
      ctx.lineTo(z.turnPoint, z.centerPos + z.turnDir * drawn2);
    }
  }
  ctx.stroke();

  ctx.globalAlpha = exitAlpha;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "butt";
  ctx.beginPath();

  if (drawn1 > 0) {
    let prevD: number | null = null;
    for (let d = 0; d <= drawn1; d += step) {
      const cx = isVert ? z.centerPos : seg1Origin + z.direction * d;
      const cy = isVert ? seg1Origin + z.direction * d : z.centerPos;
      if (prevD !== null) {
        const px = isVert ? z.centerPos : seg1Origin + z.direction * (prevD + LINK_R);
        const py = isVert ? seg1Origin + z.direction * (prevD + LINK_R) : z.centerPos;
        const nx = isVert ? z.centerPos : seg1Origin + z.direction * (d - LINK_R);
        const ny = isVert ? seg1Origin + z.direction * (d - LINK_R) : z.centerPos;
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
      }
      ctx.moveTo(cx + LINK_R, cy);
      ctx.arc(cx, cy, LINK_R, 0, Math.PI * 2);
      prevD = d;
    }
  }

  if (drawn2 > 0) {
    let prevD: number | null = null;
    for (let d = 0; d <= drawn2; d += step) {
      const cx = isVert ? z.centerPos + z.turnDir * d : z.turnPoint;
      const cy = isVert ? z.turnPoint : z.centerPos + z.turnDir * d;
      if (prevD !== null) {
        const px = isVert ? z.centerPos + z.turnDir * (prevD + LINK_R) : z.turnPoint;
        const py = isVert ? z.turnPoint : z.centerPos + z.turnDir * (prevD + LINK_R);
        const nx = isVert ? z.centerPos + z.turnDir * (d - LINK_R) : z.turnPoint;
        const ny = isVert ? z.turnPoint : z.centerPos + z.turnDir * (d - LINK_R);
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
      }
      ctx.moveTo(cx + LINK_R, cy);
      ctx.arc(cx, cy, LINK_R, 0, Math.PI * 2);
      prevD = d;
    }
  }

  ctx.stroke();
}

function drawTrackingChain(ctx: CanvasRenderingContext2D, z: Zone): void {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const width = cfg.chainWidth ?? 16;
  const connectorWidth = width * 0.42;
  const ringRadius = width * 0.36;
  const points = sampleTrackingPoints(z.trackPoints, Math.max(11, ringRadius * 2.4));
  if (points.length === 0) return;

  if (points.length > 1) {
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = cfg.linkColor;
    ctx.lineWidth = width * 1.15;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= ringRadius * 2) continue;
      const ux = dx / dist;
      const uy = dy / dist;
      ctx.moveTo(prev.x + ux * ringRadius, prev.y + uy * ringRadius);
      ctx.lineTo(curr.x - ux * ringRadius, curr.y - uy * ringRadius);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth = connectorWidth;
  ctx.lineCap = "round";
  if (points.length > 1) {
    ctx.beginPath();
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= ringRadius * 2) continue;
      const ux = dx / dist;
      const uy = dy / dist;
      ctx.moveTo(prev.x + ux * ringRadius, prev.y + uy * ringRadius);
      ctx.lineTo(curr.x - ux * ringRadius, curr.y - uy * ringRadius);
    }
    ctx.stroke();
  }

  ctx.lineWidth = Math.max(2, width * 0.2);
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (const point of points) {
    ctx.moveTo(point.x + ringRadius, point.y);
    ctx.arc(point.x, point.y, ringRadius, 0, Math.PI * 2);
  }
  ctx.stroke();
}

export function drawWarnings(ctx: CanvasRenderingContext2D, arenas: [Arena, Arena]): void {
  ctx.shadowBlur = 0;

  for (const z of zones) {
    const arena = arenas[z.arenaIdx];
    ctx.save();
    ctx.beginPath();
    ctx.rect(arena.x, arena.y, arena.w, arena.h);
    ctx.clip();

    if (z.phase === "warning") {
      const wDur = (CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal).warningDuration ?? WARNING_DURATION;
      const a = z.elapsed / wDur;
      if (z.chainType === "fake") drawFakeWarning(ctx, z, arena, a);
      else drawBand(ctx, z, arena, a);
      if (z.chainType === "turn") drawTurnArrow(ctx, z, a);
    } else if (z.phase === "flash") {
      const pulse = 0.5 + 0.5 * Math.sin((z.elapsed / FLASH_DURATION) * Math.PI * 10);
      if (z.chainType === "fake") drawFakeWarning(ctx, z, arena, pulse);
      else drawBand(ctx, z, arena, pulse);
      if (z.chainType === "turn") drawTurnArrow(ctx, z, pulse);
    } else {
      if (z.chainType === "turn") drawTurnChainLinks(ctx, z, arena);
      else if (z.chainType === "giant") drawGiantChainLinks(ctx, z, arena);
      else if (z.chainType === "tracking") drawTrackingChain(ctx, z);
      else drawChainLinks(ctx, z, arena);
    }

    ctx.restore();
  }
}
