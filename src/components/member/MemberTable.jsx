import { Status } from '../common';

export function MemberTable({ members, memberPassSummary, onOpenMember, onReregister }) {
  return (
    <section className="admin-section">
      <div className="member-table-wrap">
        <table className="member-table">
          <thead>
            <tr>
              <th>회원명</th>
              <th>생년월일</th>
              <th>전화번호</th>
              <th>이용권</th>
              <th>레슨상태</th>
              <th>이력상태</th>
              <th>재등록</th>
            </tr>
          </thead>
          <tbody>
            {[...members]
              .sort((a, b) => (a.role === '관리자' ? -1 : 0) - (b.role === '관리자' ? -1 : 0))
              .map((item) => {
                const summary = item.role === '관리자' ? null : memberPassSummary(item.name);
                const withdrawn = item.status === '탈퇴' || item.history === '탈퇴';
                const expired = Boolean(summary?.done) || withdrawn;
                const historyLabel = withdrawn ? '탈퇴' : (summary?.done ? '만료' : (item.history || '이용중'));
                return (
                  <tr key={item.id || item.name} className={expired ? 'member-row-expired' : ''}>
                    <td
                      className="member-name"
                      onClick={() => onOpenMember(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      {item.name}
                    </td>
                    <td>{item.birth}</td>
                    <td>{item.phone}</td>
                    <td>
                      {summary ? (
                        <span className={`pass-count-cell ${summary.done ? 'done' : ''}`}>
                          {summary.used}/{summary.total}회
                          {summary.done && <em className="pass-done-badge">완료</em>}
                        </span>
                      ) : '-'}
                    </td>
                    <td><Status value={item.status} /></td>
                    <td>{historyLabel}</td>
                    <td>
                      {summary && summary.done && !withdrawn ? (
                        <button
                          className="renotify-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onReregister(item);
                          }}
                        >
                          재등록
                        </button>
                      ) : ''}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
