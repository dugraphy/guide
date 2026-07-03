export function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}
