// 게임 내 랜덤 — 온라인 모드에선 seed 기반 PRNG로 교체해 양쪽 동기화
let _rng: () => number = Math.random;

export function rng(): number {
  return _rng();
}

// mulberry32 PRNG (빠르고 품질 좋은 32비트 PRNG)
export function seedRng(seed: number): void {
  let s = seed >>> 0;
  _rng = (): number => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

export function resetRng(): void {
  _rng = Math.random;
}
