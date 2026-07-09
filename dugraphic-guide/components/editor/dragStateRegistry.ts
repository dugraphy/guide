"use client";

// 여러 BlockNote 에디터(메인 + 탭마다 하나씩) 사이의 드래그 상태 잔여 정리.
//
// BlockNote 코어(SideMenuView, node_modules/@blocknote/core/src/extensions/SideMenu/SideMenu.ts)는
// 드래그가 끝나면(dragend) 모든 에디터의 `pmView.dragging`을 null로, `blockDragEnd()`가
// `isDragOrigin`을 false로 되돌리는 걸 전제로 설계되어 있다. 문제는 이 정리가 "dragend 이벤트가
// 실제로 document까지 버블링된다"에 의존하는데, dragend는 드래그를 시작한 그 DOM 엘리먼트를
// target으로 발생한다 — 그런데 BlockNote의 SideMenu 자체가 `{block?.id && <Component/>}`로
// 조건부 렌더링되는 팝오버 안에 드래그 핸들 버튼을 두고 있어서(SideMenuController.tsx), 만약
// 드래그 도중 그 핸들이 리액트 리렌더로 언마운트되는 순간이 있으면(예: Esc 등 keydown이
// `state.show`를 꺼버리는 경우 — SideMenu.ts의 onKeyDown), 이후 발생하는 dragend가 이미 DOM에서
// 떨어져 나간 엘리먼트를 target으로 삼아 document까지 버블링되지 못하고, 그러면 pmView.dragging/
// isDragOrigin이 다음 드래그로 그대로 새어 들어간다. 다음 드래그의 onDragStart는
// "if (this.pmView.dragging) return; // already dragging"로 이미 값이 있으면 새로 파싱을
// 건너뛰므로, 드롭 시 지금 드래그 중인 게 아니라 예전에 남은(혹은 비어있는) slice가 쓰여 표가
// 통째로 사라지거나 엉뚱한 내용(텍스트만) 삽입되는 것처럼 보일 수 있다 — 매번이 아니라 이런
// "끊긴 드래그"가 먼저 있어야만 나타나는 간헐적 증상과 정확히 들어맞는다.
//
// BlockNote 내부(SideMenuView 인스턴스, onDragStart의 "already dragging" 가드)는 고칠 수 없으니,
// 대신 새 드래그가 시작될 때마다(document의 dragstart, capture 단계 — BlockNote 자신의 리스너는
// bubble 단계라 이보다 항상 먼저 실행된다) 등록된 모든 에디터의 잔여 드래그 상태를 선제적으로
// 정리해서, 이전 드래그가 어떻게 끝났든 새 드래그는 항상 깨끗한 상태에서 시작하게 한다.
import type { BlockNoteEditor } from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registeredEditors = new Set<BlockNoteEditor<any, any, any>>();
let cleanupListenerInstalled = false;

function resetDragStateForAllEditors() {
  for (const editor of registeredEditors) {
    try {
      const view = editor.prosemirrorView;
      if (view) {
        // prosemirror-view가 own 드래그 슬라이스를 들고 있는 raw 속성 — BlockNote의
        // SideMenuView.onDragEnd도 정확히 이 필드를 null로 되돌리는 방식으로 정리한다.
        view.dragging = null;
      }
      // isDragOrigin=false 리셋 + drag preview 엘리먼트 제거까지 공개 API로 한 번에 처리된다.
      editor.getExtension(SideMenuExtension)?.blockDragEnd();
    } catch {
      // 에디터가 막 언마운트되었거나 headless인 경우 등 — 이 정리 목적상 무시하고 계속 진행.
    }
  }
}

function installCleanupListenerOnce() {
  if (cleanupListenerInstalled || typeof document === "undefined") {
    return;
  }
  cleanupListenerInstalled = true;
  document.addEventListener(
    "dragstart",
    (e) => {
      // BlockNote의 dropCursor/SideMenu가 내부적으로 만드는 합성(synthetic) dragstart는
      // 건너뛴다 — 실제 사용자가 새로 시작한 드래그에서만 이전 상태를 정리하면 된다.
      if ((e as unknown as { synthetic?: boolean }).synthetic) {
        return;
      }
      resetDragStateForAllEditors();
    },
    true, // capture: BlockNote 자신의 (bubble 단계) dragstart 리스너보다 항상 먼저 실행되도록.
  );
}

/**
 * 메인 에디터/탭 서브 에디터가 마운트될 때 호출한다. 이 에디터를 전역 드래그 상태 정리
 * 대상으로 등록하고, cleanup(useEffect의 반환값)에서 해제한다.
 */
export function registerDragStateEditor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: BlockNoteEditor<any, any, any>,
): () => void {
  installCleanupListenerOnce();
  registeredEditors.add(editor);
  return () => {
    registeredEditors.delete(editor);
  };
}
