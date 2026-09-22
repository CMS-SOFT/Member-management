import { Status } from '../common';

// 회원정보 탭: 회원 목록 표. 회원 이름 클릭 시 상세 열기, 완료(재등록 대상) 회원은 재등록 버튼 노출.
export function MemberTable({ members, memberPassSummary, onOpenMember, onOpenRegister, onReregister }) {
  return <section className="admin-section">
    <div className="admin-section-heading admin-section-heading--end">
      <button className="add-button" onClick={onOpenRegister}>＋ 회원 등록</button>
    </div>
    <div className="member-table-wrap">
      <table className="member-table">
        <thead>
          <tr><th>회원명</th><th>생년월일</th><th>전화번호</th><th>이용권</th><th>레슨상태</th><th>이력상태</th><th>재등록</th></tr>
        </thead>
        <tbody>{[...members].sort((a, b) => (a.role === '관리자' ? -1 : 0) - (b.role === '관리자' ? -1 : 0)).map((item) => {
          const summary = item.role === '관리자' ? null : memberPassSummary(item.name);
          return <tr key={item.name}>
            {/* 💡 회원 이름 셀에만 onClick과 마우스 커서 스타일을 적용합니다 */}
            <td
              className="member-name"
              onClick={() => onOpenMember(item)}
              style={{ cursor: 'pointer' }}
            >
              {item.name}
            </td>
            <td>{item.birth}</td>
            <td>{item.phone}</td>
            <td>{summary ? <span className={`pass-count-cell ${summary.done ? 'done' : ''}`}>{summary.used}/{summary.total}회</span> : '-'}</td>
            <td><Status value={item.status} /></td>
            <td>{item.history}</td>
            <td>{summary && summary.done ? <button className="renotify-button" onClick={(event) => { event.stopPropagation(); onReregister(item); }}>재등록</button> : ''}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}