"use client";

// 여러 BlockNote 에디터(메인 + 탭마다 하나씩) 사이의 드래그를 안전하게 만들기 위한 두 가지 장치.
//
// 1) 새 드래그가 시작될 때마다 모든 등록된 에디터의 pmView.dragging을 정리한다. BlockNote 코어
//    (SideMenuView, node_modules/@blocknote/core/src/extensions/SideMenu/SideMenu.ts)는 dragend
//    이벤트가 document까지 정상적으로 버블링되는 것을 전제로 정리 로직을 짜놨는데, dragend는
//    드래그를 시작한 그 DOM 엘리먼트를 target으로 발생한다 — SideMenu 자체가 조건부 렌더링되는
//    팝오버 안에 드래그 핸들을 두고 있어서(SideMenuController.tsx `{block?.id && <Component/>}`),
//    드래그 도중 그 핸들이 리렌더로 언마운트되면(예: keydown이 state.show를 꺼버리는 경우 —
//    SideMenu.ts onKeyDown) 이후 dragend가 이미 떨어져나간 엘리먼트를 target으로 삼아 document까지
//    닿지 못할 수 있다. 이러면 pmView.dragging이 다음 드래그로 새어 들어가 엉뚱한 slice가 쓰일
//    위험이 있다.
//
//    ⚠️ 처음 버전은 여기서 BlockNote의 blockDragEnd()(내부적으로 editor.blur() 호출)까지 같이
//    불렀는데, 그게 오히려 "거의 매번 실패"로 증상을 악화시켰다 — dragstart의 capture 단계에서
//    "지금 막 이 드래그를 시작한" 에디터까지 포함해 전부 blur() 하면, 그 직후 bubble 단계에서
//    실행되는 dragStart()(NodeSelection 지정 등 이 드래그 자체의 셋업)와 충돌할 여지가 있었다.
//    그래서 지금은 raw한 pmView.dragging = null만 정리하고 blur는 절대 호출하지 않는다.
//
// 2) (더 중요) 그렇게 해도 근본 원인을 100% 확신할 수 없으므로, 드래그 시작 시점의 모든 등록된
//    에디터 문서를 스냅샷으로 저장해두고, 드래그가 끝난 뒤 전체 콘텐츠 총량이 의심스럽게
//    줄어들면(표가 사라지거나 텍스트로 뭉개지는 등) 자동으로 스냅샷 상태로 되돌린다. 원인이
//    무엇이든— BlockNote 자체 버그든, 이 파일의 정리 로직 자체든 — 결과적으로 데이터가 사라지는
//    것만은 항상 막는 안전망이다. dragend가 아예 발생하지 않는 최악의 경우까지 대비해 다음
//    dragstart 시점과 타임아웃에서도 한 번 더 확인한다.
import type { BlockNoteEditor } from "@blocknote/core";
import { showErrorToast } from "@/components/Toast";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = BlockNoteEditor<any, any, any>;

const registeredEditors = new Set<AnyEditor>();
let cleanupListenerInstalled = false;

function resetDragStateForAllEditors() {
  for (const editor of registeredEditors) {
    try {
      const view = editor.prosemirrorView;
      if (view) {
        // prosemirror-view가 자기 드래그 슬라이스를 들고 있는 raw 속성 — BlockNote의
        // SideMenuView.onDragEnd도 정확히 이 필드를 null로 되돌리는 방식으로 정리한다.
        // (blur()는 절대 호출하지 않는다 — 위 설명 참고.)
        view.dragging = null;
      }
    } catch {
      // 에디터가 막 언마운트되었거나 headless인 경우 등 — 이 정리 목적상 무시하고 계속 진행.
    }
  }
}

// ── 스냅샷 + 복원 안전망 ────────────────────────────────────────────────────

type Snapshot = Map<AnyEditor, string>; // editor -> JSON.stringify(editor.document)

interface PendingCheck {
  snapshot: Snapshot;
  beforeTotalLength: number;
  verified: boolean;
  hardTimeoutId: ReturnType<typeof setTimeout>;
}

let pending: PendingCheck | null = null;

function takeSnapshot(): { snapshot: Snapshot; totalLength: number } {
  const snapshot: Snapshot = new Map();
  let totalLength = 0;
  for (const editor of registeredEditors) {
    try {
      const json = JSON.stringify(editor.document);
      snapshot.set(editor, json);
      totalLength += json.length;
    } catch {
      // 이 에디터는 스냅샷에서 제외 — 복원 시에도 건드리지 않는다.
    }
  }
  return { snapshot, totalLength };
}

function currentTotalLength(editors: Iterable<AnyEditor>): number {
  let total = 0;
  for (const editor of editors) {
    try {
      total += JSON.stringify(editor.document).length;
    } catch {
      // ignore
    }
  }
  return total;
}

function restoreSnapshot(snapshot: Snapshot) {
  for (const [editor, json] of snapshot) {
    try {
      const blocks = JSON.parse(json);
      if (Array.isArray(blocks)) {
        editor.replaceBlocks(editor.document, blocks);
      }
    } catch {
      // 이 에디터는 복원 실패 — 다른 에디터라도 계속 복원 시도.
    }
  }
}

// 드래그 총량이 눈에 띄게 줄었으면(표 하나가 통째로 사라지거나 텍스트로 뭉개지는 등) 데이터
// 손실로 간주하고 드래그 시작 시점 스냅샷으로 되돌린다. 사소한 공백/포맷 차이까지 오탐하지
//않도록 약간의 여유(허용 오차)를 둔다.
function verifyAndRestoreIfNeeded(check: PendingCheck) {
  if (check.verified) {
    return;
  }
  check.verified = true;
  clearTimeout(check.hardTimeoutId);

  const after = currentTotalLength(check.snapshot.keys());
  const before = check.beforeTotalLength;
  const shrinkage = before - after;
  const shrinkRatio = before > 0 ? shrinkage / before : 0;

  // 30자 미만의 절대 감소, 또는 2% 미만의 상대 감소는 정상적인 사소한 차이(공백 정리 등)로
  // 보고 넘어간다. 그보다 크게 줄었으면 표/블록이 실제로 사라졌을 가능성이 높다.
  if (shrinkage > 30 && shrinkRatio > 0.02) {
    restoreSnapshot(check.snapshot);
    showErrorToast(
      "드래그 중 내용이 손실될 뻔해 자동으로 되돌렸습니다. 다시 시도해주세요.",
    );
  }
}

function installCleanupListenerOnce() {
  if (cleanupListenerInstalled || typeof document === "undefined") {
    return;
  }
  cleanupListenerInstalled = true;

  const isSynthetic = (e: Event) => (e as unknown as { synthetic?: boolean }).synthetic;

  document.addEventListener(
    "dragstart",
    (e) => {
      if (isSynthetic(e)) {
        return;
      }
      // 이전 드래그가 dragend 없이 끝나버린 경우(예: 브라우저가 이벤트를 못 내는 극단적인
      // 경우) 대비 — 새 드래그를 시작하기 전에 아직 확인되지 않은 이전 스냅샷이 남아있으면
      // 먼저 확인·필요시 복원부터 한다.
      if (pending) {
        verifyAndRestoreIfNeeded(pending);
        pending = null;
      }

      resetDragStateForAllEditors();

      const { snapshot, totalLength } = takeSnapshot();
      let check: PendingCheck;
      // eslint-disable-next-line prefer-const
      check = {
        snapshot,
        beforeTotalLength: totalLength,
        verified: false,
        // dragend도, 다음 dragstart도 안 오는 최악의 경우를 위한 하드 타임아웃.
        hardTimeoutId: setTimeout(() => {
          if (pending === check) {
            verifyAndRestoreIfNeeded(check);
            pending = null;
          }
        }, 4000),
      };
      pending = check;
    },
    true, // capture: BlockNote 자신의 (bubble 단계) dragstart 리스너보다 항상 먼저 실행되도록.
  );

  document.addEventListener(
    "dragend",
    (e) => {
      if (isSynthetic(e) || !pending) {
        return;
      }
      const check = pending;
      // BlockNote 자신의 onDrop이 origin 에디터의 콘텐츠를 setTimeout(..., 0)으로 지우므로,
      // 그게 실행되고 난 뒤의 최종 상태를 확인해야 한다.
      setTimeout(() => {
        if (pending === check) {
          verifyAndRestoreIfNeeded(check);
          pending = null;
        }
      }, 100);
    },
    true,
  );
}

/**
 * 메인 에디터/탭 서브 에디터가 마운트될 때 호출한다. 이 에디터를 전역 드래그 상태 정리·안전망
 * 대상으로 등록하고, cleanup(useEffect의 반환값)에서 해제한다.
 */
export function registerDragStateEditor(editor: AnyEditor): () => void {
  installCleanupListenerOnce();
  registeredEditors.add(editor);
  return () => {
    registeredEditors.delete(editor);
  };
}
