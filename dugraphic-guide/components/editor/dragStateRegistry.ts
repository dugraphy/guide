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
//    에디터 문서를 스냅샷으로 저장해두고, 드래그가 끝난 뒤 "드래그 시작 시점에 존재하던 블록
//    id가 하나라도 사라졌는지"를 확인해 그러면 자동으로 스냅샷 상태로 되돌린다. 원인이 무엇이든
//    — BlockNote 자체 버그든, 이 파일의 정리 로직 자체든 — 결과적으로 데이터가 사라지는 것만은
//    항상 막는 안전망이다. dragend가 아예 발생하지 않는 최악의 경우까지 대비해 다음 dragstart
//    시점과 타임아웃에서도 한 번 더 확인한다.
//
//    ⚠️ 처음 버전은 "등록된 모든 에디터의 JSON 문자열 길이 합"이 일정 비율 이상 줄었는지로
//    판단했는데, 실제 사용자 영상으로 재현해보니 이 방식은 무력했다: 탭 안 표를 탭 밖으로
//    드래그했을 때 실제로 벌어진 일은 (a) 표가 엉뚱한 위치(메인 에디터의 다른 헤딩 바로 아래)에
//    끼어들면서 (b) 원래 그 자리에 있던 calloutBox 블록을 통째로 밀어내 사라지게 만들고,
//    (c) 표가 있던 원래 자리는 빈 문단으로 남는 것이었다 — 표 콘텐츠 자체는 다른 곳으로
//    옮겨갔을 뿐이라 등록된 에디터 전체를 합친 글자수 총량은 거의 줄지 않았고, 그래서 길이
//    기반 휴리스틱이 이 손실을 통과시켰다. BlockNote가 드래그 페이로드(blocknote/html)에
//    블록의 원래 id를 `data-id`로 그대로 실어 보내고(각 SideMenuView가 그 html을 파싱해
//    view.dragging을 채우는 방식, node_modules/@blocknote/core/.../SideMenu.ts의 onDragStart
//    참고) 정상적인 "이동"은 그 id를 새 위치에서도 그대로 재사용한다는 점에 착안해, 지금은
//    "총량"이 아니라 "드래그 시작 시점에 있던 블록 id 집합이 드래그 후에도 (등록된 에디터
//    전체를 통틀어) 전부 그대로 남아있는가"를 확인한다. 표 자신의 id는 이동했으므로 계속
//    남아있고, calloutBox처럼 엉뚱하게 밀려나 사라진 블록의 id는 사라진 채로 남아 바로
//    잡아낼 수 있다.
import type { BlockNoteEditor } from "@blocknote/core";
import { showErrorToast } from "@/components/Toast";
import { dndLog, dumpRecentDndLog } from "./dragDebugLog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = BlockNoteEditor<any, any, any>;

const registeredEditors = new Set<AnyEditor>();
// TEMP DIAGNOSTIC — 각 등록된 에디터가 "메인"인지 "탭: <제목>"인지 사람이 읽을 수 있는
// 이름. 로그에서 어느 에디터/탭에서 이벤트가 발생했는지 구분하기 위해서만 쓴다.
const editorLabels = new Map<AnyEditor, string>();
// 이 서브 에디터가 어느 tabGroup 블록의 "현재 활성 탭"을 실체화한 것인지 (메인 에디터는
// undefined). 아래 computeCurrentBlockMap이 비활성 탭(마운트되지 않아 라이브 에디터가
// 없는 탭)의 블록도 놓치지 않고 판정하는 데 쓴다.
const editorOwnerTabGroupId = new Map<AnyEditor, string | undefined>();
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
  blockMapBefore: Map<string, string>; // id -> fingerprint(내용, id 제외)
  verified: boolean;
  hardTimeoutId: ReturnType<typeof setTimeout>;
}

let pending: PendingCheck | null = null;

// 블록의 id/children의 개별 id는 무시하고 "구조·내용이 같은 블록인가"만 비교하기 위한
// 지문. 실제 사용자 로그로 확인된 두 번째 오탐 원인: 같은 탭 안에서 표를 살짝만 옮겨도
// BlockNote가 (아마도 내부적인 삭제-후-재삽입 방식으로) 그 블록에 새 id를 부여하는 경우가
// 있다 — 내용은 그대로인데 id만 바뀌는, 데이터 손실이 아닌 정상적인 상황이다. id만 보고
// "사라졌다"고 판단하면 이런 경우까지 전부 오탐으로 잡아 불필요하게 되돌리고 에러 토스트를
// 띄우게 된다. 그래서 "이전 id가 사라졌어도, 같은 지문의 블록이 어딘가에 남아있으면"
// 손실이 아니라 단순 재배치/id 교체로 간주한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fingerprintBlock(block: any): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const strip = (b: any): any => {
    if (!b || typeof b !== "object") {
      return b;
    }
    if (Array.isArray(b)) {
      return b.map(strip);
    }
    const { id: _id, children, ...rest } = b;
    return { ...rest, children: Array.isArray(children) ? children.map(strip) : children };
  };
  return JSON.stringify(strip(block));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectBlockMapPlain(blocks: any[] | undefined, out: Map<string, string>) {
  if (!Array.isArray(blocks)) {
    return;
  }
  for (const block of blocks) {
    if (block && typeof block.id === "string") {
      out.set(block.id, fingerprintBlock(block));
    }
    if (Array.isArray(block?.children) && block.children.length > 0) {
      collectBlockMapPlain(block.children, out);
    }
  }
}

// tabGroup 블록은 각 탭의 콘텐츠를 실제 자식 블록이 아니라 props.tabs(JSON 문자열)에
// 저장하고, 그중 "현재 활성 탭"만 별도의 라이브 서브 에디터(TabGroupBlock.tsx의 TabPane,
// key={activeTab}로 탭을 전환할 때마다 마운트/언마운트됨)로 실체화한다. 그래서 비활성
// 탭은 애초에 registeredEditors에 라이브 에디터가 존재하지 않는다 — "에디터 인스턴스가
// 있는지"로 블록 존재 여부를 판정하면 비활성 탭의 블록은 항상 "사라진 것"으로 오판된다
// (실제 사용자 로그로 확인된 첫 번째 오탐 원인).
//
// 그래서 메인 문서를 순회하다 tabGroup 블록을 만나면: 활성 탭은 등록된 라이브 서브
// 에디터가 있으면 그 최신 상태(.document)를 쓰고(props.tabs는 마지막 저장/탭 전환
// 시점에만 동기화되므로 활성 탭 안에서는 오래된 값일 수 있다), 그 외 모든(비활성) 탭은
// props.tabs에 저장된 데이터를 직접 파싱해 판정한다 — 라이브 에디터가 있든 없든 항상
// 정확하다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectMainDocumentBlockMap(blocks: any[] | undefined, liveEditorsByOwner: Map<string, AnyEditor>, out: Map<string, string>) {
  if (!Array.isArray(blocks)) {
    return;
  }
  for (const block of blocks) {
    if (!block || typeof block.id !== "string") {
      continue;
    }
    out.set(block.id, fingerprintBlock(block));

    if (block.type === "tabGroup") {
      const activeTabIndex = typeof block.props?.activeTab === "number" ? block.props.activeTab : 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let tabs: Array<{ content?: any[] }> = [];
      try {
        const parsed = JSON.parse(block.props?.tabs ?? "[]");
        if (Array.isArray(parsed)) {
          tabs = parsed;
        }
      } catch {
        // props.tabs가 깨진 JSON이면 이 tabGroup 블록의 하위 탭 콘텐츠는 판정 불가 —
        // 블록 자신의 id는 이미 위에서 추가했으니 그대로 둔다.
      }
      const liveEditor = liveEditorsByOwner.get(block.id);
      tabs.forEach((tab, index) => {
        if (index === activeTabIndex && liveEditor) {
          try {
            collectBlockMapPlain(liveEditor.document, out);
            return;
          } catch {
            // 라이브 에디터 읽기 실패 — 아래 props.tabs 폴백으로 넘어간다.
          }
        }
        collectBlockMapPlain(tab.content, out);
      });
      continue;
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      collectMainDocumentBlockMap(block.children, liveEditorsByOwner, out);
    }
  }
}

// 등록된 에디터 중 "메인"(어느 tabGroup에도 속하지 않은) 에디터를 찾아, 그 문서를
// tabGroup-aware하게 순회해서 현재 존재하는 모든 블록의 id -> 지문 맵을 계산한다. 메인
// 에디터를 못 찾는 예외적인 경우(테스트 환경 등)에는 등록된 모든 에디터를 그냥 평평하게
// 스캔하는 이전 방식으로 안전하게 폴백한다.
function computeCurrentBlockMap(): Map<string, string> {
  const ids = new Map<string, string>();
  let mainEditor: AnyEditor | undefined;
  const liveEditorsByOwner = new Map<string, AnyEditor>();

  for (const editor of registeredEditors) {
    const owner = editorOwnerTabGroupId.get(editor);
    if (owner === undefined) {
      if (!mainEditor) {
        mainEditor = editor;
      }
    } else {
      liveEditorsByOwner.set(owner, editor);
    }
  }

  if (!mainEditor) {
    // 폴백: 메인 에디터를 식별할 수 없으면 예전처럼 등록된 모든 에디터를 평평하게 스캔한다.
    for (const editor of registeredEditors) {
      try {
        collectBlockMapPlain(editor.document, ids);
      } catch {
        // ignore
      }
    }
    return ids;
  }

  try {
    collectMainDocumentBlockMap(mainEditor.document, liveEditorsByOwner, ids);
  } catch {
    // ignore
  }
  return ids;
}

function takeSnapshot(): { snapshot: Snapshot; blockMapBefore: Map<string, string> } {
  const snapshot: Snapshot = new Map();
  for (const editor of registeredEditors) {
    try {
      snapshot.set(editor, JSON.stringify(editor.document));
    } catch {
      // 이 에디터는 스냅샷에서 제외 — 복원 시에도 건드리지 않는다.
    }
  }
  const blockMapBefore = computeCurrentBlockMap();
  return { snapshot, blockMapBefore };
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

// 드래그 시작 시점에 존재하던 블록 id 중 하나라도 (등록된 에디터 전체를 통틀어) 사라졌으면
// 일단 의심하되, 곧바로 손실로 단정하지 않는다 — 같은 지문(내용, id 제외)의 블록이 현재
// 상태 어딘가에 남아있으면 그건 그냥 id가 바뀐 정상적인 재배치이므로 손실이 아니다(위
// fingerprintBlock 주석 참고). 어떤 지문으로도 찾을 수 없는, 진짜로 사라진 경우에만
// 드래그 시작 시점 스냅샷으로 되돌린다.
function verifyAndRestoreIfNeeded(check: PendingCheck) {
  if (check.verified) {
    return;
  }
  check.verified = true;
  clearTimeout(check.hardTimeoutId);

  const mapAfter = computeCurrentBlockMap();
  const afterFingerprints = new Set(mapAfter.values());

  const trulyMissingIds = [...check.blockMapBefore.entries()]
    .filter(([id, fingerprint]) => !mapAfter.has(id) && !afterFingerprints.has(fingerprint))
    .map(([id]) => id);

  if (trulyMissingIds.length > 0) {
    dndLog("restore-triggered", `사라진 블록 id: [${trulyMissingIds.join(", ")}]`);
    dumpRecentDndLog(`안전망 복원 발생 (사라진 블록: ${trulyMissingIds.join(", ")})`);
    restoreSnapshot(check.snapshot);
    showErrorToast(
      "드래그 중 내용이 손실될 뻔해 자동으로 되돌렸습니다. 다시 시도해주세요.",
    );
  }
}

// TEMP DIAGNOSTIC — 이벤트가 어느 에디터(메인/탭)에서 일어났는지, 어느 블록 위였는지를
// 사람이 읽을 수 있는 한 줄로 요약한다. 원인 확정 후 dragDebugLog.ts와 함께 제거할 것.
function findEditorLabel(target: EventTarget | null): string {
  if (!(target instanceof Node)) {
    return "?";
  }
  for (const [editor, label] of editorLabels) {
    try {
      if (editor.prosemirrorView?.dom.contains(target)) {
        return label;
      }
    } catch {
      // ignore
    }
  }
  return "(등록된 에디터 밖)";
}

function findBlockId(target: EventTarget | null): string {
  if (!(target instanceof Element)) {
    return "?";
  }
  const el = target.closest('[data-node-type="blockContainer"]');
  return el?.getAttribute("data-id") ?? "?";
}

function describeDragEvent(e: DragEvent): string {
  const synthetic = (e as unknown as { synthetic?: boolean }).synthetic ? " SYNTHETIC" : "";
  const label = findEditorLabel(e.target);
  const blockId = findBlockId(e.target);
  const types = e.dataTransfer ? Array.from(e.dataTransfer.types).join(",") : "";
  return `target-editor=${label} block=${blockId} pos=(${Math.round(e.clientX)},${Math.round(e.clientY)}) dropEffect=${e.dataTransfer?.dropEffect ?? "?"} types=[${types}]${synthetic}`;
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
      const de = e as DragEvent;
      dndLog("dragstart", describeDragEvent(de));
      if (isSynthetic(e)) {
        return;
      }
      // 이전 드래그가 dragend 없이 끝나버린 경우(예: 브라우저가 이벤트를 못 내는 극단적인
      // 경우) 대비 — 새 드래그를 시작하기 전에 아직 확인되지 않은 이전 스냅샷이 남아있으면
      // 먼저 확인·필요시 복원부터 한다.
      if (pending) {
        dndLog("dragstart", "이전 드래그의 pending 스냅샷이 아직 확인되지 않음 — 먼저 확인");
        verifyAndRestoreIfNeeded(pending);
        pending = null;
      }

      resetDragStateForAllEditors();

      const { snapshot, blockMapBefore } = takeSnapshot();
      dndLog("dragstart", `스냅샷 완료: 등록된 에디터 ${snapshot.size}개, 블록 id ${blockMapBefore.size}개`);
      let check: PendingCheck;
      // eslint-disable-next-line prefer-const
      check = {
        snapshot,
        blockMapBefore,
        verified: false,
        // dragend도, 다음 dragstart도 안 오는 최악의 경우를 위한 하드 타임아웃.
        hardTimeoutId: setTimeout(() => {
          if (pending === check) {
            dndLog("hard-timeout", "4000ms 동안 dragend가 오지 않아 타임아웃으로 확인");
            verifyAndRestoreIfNeeded(check);
            pending = null;
          }
        }, 4000),
      };
      pending = check;
    },
    true, // capture: BlockNote 자신의 (bubble 단계) dragstart 리스너보다 항상 먼저 실행되도록.
  );

  // dragover는 몇 ms마다 계속 발생해 매번 로그하면 콘솔이 넘친다 — "커서가 가리키는
  // 에디터(target-editor)가 바뀐 순간"만, 즉 탭 경계를 넘나드는 순간만 로그한다.
  let lastDragoverLabel: string | null = null;
  document.addEventListener(
    "dragover",
    (e) => {
      const de = e as DragEvent;
      const label = findEditorLabel(de.target);
      if (label !== lastDragoverLabel) {
        dndLog("dragover(경계 변경)", `${lastDragoverLabel ?? "(없음)"} → ${label} | ${describeDragEvent(de)}`);
        lastDragoverLabel = label;
      }
    },
    true,
  );

  document.addEventListener(
    "drop",
    (e) => {
      const de = e as DragEvent;
      dndLog("drop", describeDragEvent(de));
    },
    true,
  );

  document.addEventListener(
    "dragend",
    (e) => {
      const de = e as DragEvent;
      dndLog("dragend", describeDragEvent(de));
      lastDragoverLabel = null;
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
 *
 * label은 TEMP DIAGNOSTIC 로그에서 "메인"/"탭: xxx"처럼 사람이 읽을 수 있는 이름으로만 쓰인다.
 *
 * ownerTabGroupBlockId는 이 에디터가 특정 tabGroup 블록의 "현재 활성 탭"을 실체화한
 * 서브 에디터일 때 그 tabGroup 블록의 id를 전달한다. 메인 에디터는 생략한다(undefined) —
 * computeCurrentBlockMap이 이 값으로 "메인 에디터"와 "탭 서브 에디터"를 구분한다.
 */
export function registerDragStateEditor(
  editor: AnyEditor,
  label: string = "?",
  ownerTabGroupBlockId?: string,
): () => void {
  installCleanupListenerOnce();
  registeredEditors.add(editor);
  editorLabels.set(editor, label);
  editorOwnerTabGroupId.set(editor, ownerTabGroupBlockId);
  return () => {
    registeredEditors.delete(editor);
    editorLabels.delete(editor);
    editorOwnerTabGroupId.delete(editor);
  };
}
