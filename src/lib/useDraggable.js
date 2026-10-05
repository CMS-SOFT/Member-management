import { useRef, useState, useCallback } from 'react';

// 지정한 핸들(헤더 등)을 잡고 끌어 요소를 이동시키는 훅.
// 반환: dragHandleProps(핸들에 스프레드), style(대상 요소에 적용), isDragging.
export function useDraggable() {
  const [offset, setOffset] = useState(null); // null이면 CSS 기본 위치 유지
  const [isDragging, setIsDragging] = useState(false);
  const start = useRef({ x: 0, y: 0, baseX: 0, baseY: 0 });

  const onPointerDown = useCallback((event) => {
    // 버튼/입력 요소를 잡은 경우엔 드래그를 시작하지 않습니다.
    if (event.target.closest('button, input, select, textarea, a')) return;
    const base = offset || { x: 0, y: 0 };
    start.current = { x: event.clientX, y: event.clientY, baseX: base.x, baseY: base.y };
    setIsDragging(true);

    const onMove = (moveEvent) => {
      setOffset({
        x: start.current.baseX + (moveEvent.clientX - start.current.x),
        y: start.current.baseY + (moveEvent.clientY - start.current.y),
      });
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [offset]);

  const style = offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined;
  const dragHandleProps = { onPointerDown, style: { cursor: 'move', touchAction: 'none' } };
  return { dragHandleProps, style, isDragging };
}
