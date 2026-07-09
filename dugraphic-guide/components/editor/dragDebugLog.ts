"use client";

// ⚠️ TEMP DIAGNOSTIC LOGGING — 탭 경계를 넘는 드래그 앤 드롭 버그의 실제 재현 순간을 잡기
// 위한 임시 진단 로그. 근본 원인을 확정하면 이 파일과 모든 호출부(dragStateRegistry.ts,
// TabGroupBlock.tsx)를 함께 제거할 것.
//
// 콘솔에 전부 "[dnd]"로 시작하는 줄만 남기므로, 브라우저 개발자도구 콘솔의 필터 입력창에
// "[dnd]"를 넣어두면 다른 로그에 섞이지 않고 이것만 볼 수 있다.

interface LogEntry {
  t: number; // performance.now() 기준 ms — 상대 시간이므로 이벤트 간 간격 비교에만 쓴다.
  type: string;
  detail: string;
}

// 매 dragover마다 로그를 남기면 콘솔이 순식간에 넘쳐 정작 중요한 순간(경계를 넘는 순간,
// 실패 직전)을 찾기 어려워진다. 그래서 최근 N개만 링 버퍼에 보관해두고, 안전망이 실제로
// 복원을 실행한 시점에만 그 직전 이력을 한꺼번에 덤프한다.
const RING_SIZE = 120;
const ring: LogEntry[] = [];

function push(entry: LogEntry) {
  ring.push(entry);
  if (ring.length > RING_SIZE) {
    ring.shift();
  }
}

export function dndLog(type: string, detail: string) {
  const entry: LogEntry = { t: performance.now(), type, detail };
  push(entry);
  // eslint-disable-next-line no-console
  console.log(`[dnd] ${entry.t.toFixed(1)}ms  ${type}  ${detail}`);
}

export function dumpRecentDndLog(reason: string) {
  // eslint-disable-next-line no-console
  console.log(`[dnd] ===== ${reason} — 최근 이벤트 ${ring.length}개 =====`);
  for (const entry of ring) {
    // eslint-disable-next-line no-console
    console.log(`[dnd]   ${entry.t.toFixed(1)}ms  ${entry.type}  ${entry.detail}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[dnd] ===== 끝 =====`);
}
