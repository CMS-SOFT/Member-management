// 여러 화면에서 재사용하는 작은 프리미티브 컴포넌트 모음

// 모달 배경. 어두운 바깥 영역을 클릭하면 onClose를 호출해 팝업을 닫습니다.
// (내부 콘텐츠 클릭은 target === currentTarget 비교로 걸러 닫히지 않게 함)
export function Backdrop({ onClose, className, children }) {
  const handleClick = (event) => { if (onClose && event.target === event.currentTarget) onClose(); };
  return <div className={`modal-backdrop ${className || ''}`} onMouseDown={handleClick}>{children}</div>;
}

export function PageTitle({ eyebrow, title, actions }) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{actions ? <div className="page-title-actions">{actions}</div> : null}</div>;
}

export function Summary({ icon, label, value }) {
  return <div className="summary-item" data-icon={icon}><span>{label}</span><strong>{value}</strong></div>;
}

export function Status({ value }) {
  return <span className={`status status-${value === '완료' ? 'done' : 'pending'}`}>{value}</span>;
}
