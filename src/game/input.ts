// 현재 눌린 키 상태를 Set으로 관리 (다중 키 동시 입력 지원)
const pressedKeys = new Set<string>();

export function initInput(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    // 방향키, WASD의 기본 스크롤 동작 방지
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }
    pressedKeys.add(e.key);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    pressedKeys.delete(e.key);
  };

  // 포커스 잃으면 모든 입력 초기화 (유령 키 방지)
  const onBlur = () => {
    pressedKeys.clear();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  // cleanup 함수 반환
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
  };
}

export function isKeyDown(key: string): boolean {
  return pressedKeys.has(key);
}
