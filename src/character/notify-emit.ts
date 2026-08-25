// G3: единственный writer события 'team-m.report-arrived'.
// Все триггеры (INBOX-полл, chat-completion) зовут ТОЛЬКО отсюда.
export interface ReportArrivedDetail {
  source: 'inbox-sync' | 'mac-chat';
  reportId?: string;
  text?: string;
  ts: number;
}
export function emitReportArrived(detail: ReportArrivedDetail): void {
  try {
    window.dispatchEvent(new CustomEvent('team-m.report-arrived', { detail }));
  } catch { /* никогда не блокируем caller — G1-safe */ }
}
