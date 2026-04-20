interface NoticeContent {
  type: 'success' | 'error' | 'info';
  text: string;
  details?: string[];
}

interface AppNoticeProps {
  notice: NoticeContent | null;
}

export function AppNotice({ notice }: AppNoticeProps) {
  if (!notice) {
    return null;
  }

  return (
    <div className={`feedback-box ${notice.type}`}>
      <strong>{notice.text}</strong>
      {notice.details?.length ? (
        <ul>
          {notice.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
