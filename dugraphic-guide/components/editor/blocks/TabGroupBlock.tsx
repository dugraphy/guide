"use client";

import { createReactBlockSpec, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultBlockSpecs, selectedFragmentToHTML } from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import "@blocknote/mantine/style.css";
import type React from "react";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { useTabSyncRegistry } from "../tabSyncContext";
import { useMarkEditorDirty } from "../editorDirtyContext";
import { createResizableTableBlockSpec } from "./ResizableTableBlock";
import { registerDragStateEditor } from "../dragStateRegistry";
import { dndLog } from "../dragDebugLog";

interface TabItem {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any[];
}

const DEFAULT_TABS: TabItem[] = [
  { title: "탭 1", content: [{ type: "paragraph", content: "내용을 입력하세요" }] },
  { title: "탭 2", content: [{ type: "paragraph", content: "내용을 입력하세요" }] },
];

function parseTabs(raw: string): TabItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through to default
  }
  return DEFAULT_TABS;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBlockPlainText(block: any): string {
  if (!Array.isArray(block?.content)) return "";
  return block.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item: any) => (typeof item?.text === "string" ? item.text : ""))
    .join("")
    .trim();
}

// "기본" 표 바로 다음 블록부터 탭 끝까지를 하나의 접이식 묶음으로 묶는다. "기본" 헤딩
// 뒤에 새 표/섹션이 추가돼도 이 함수가 매번 서브 에디터 문서를 다시 훑기 때문에
// 별도 설정 없이 자동으로 같은 묶음에 포함된다. "기본" 헤딩이 없는 탭(예: 이 패턴을
// 쓰지 않는 다른 tabGroup)에서는 아무것도 숨기지 않는다.
function computeAccordionSection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: readonly any[],
): { anchorBlockId: string | null; hiddenBlockIds: string[] } {
  const headingIndex = doc.findIndex((b) => b.type === "heading" && getBlockPlainText(b) === "기본");
  if (headingIndex === -1 || headingIndex + 1 >= doc.length) {
    return { anchorBlockId: null, hiddenBlockIds: [] };
  }
  const anchorBlock = doc[headingIndex + 1];
  const hiddenBlockIds = doc.slice(headingIndex + 2).map((b) => b.id);
  return { anchorBlockId: anchorBlock.id, hiddenBlockIds };
}

// 탭 안에서 문단/표/리스트 등을 자유롭게 쓸 수 있도록 별도의 하위 BlockNote
// 스키마를 둔다. 부모 스키마(BlockEditor.tsx)를 그대로 재사용하면 이 파일과
// 순환 참조가 생기고, tabGroup을 tabGroup 안에 중첩하는 경우까지 신경 써야
// 해서 기본 블록만 있는 스키마로 범위를 제한한다.
const tabContentSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    // 탭 안 표에도 부모 에디터와 동일한 컬럼/행 리사이즈 기능을 적용한다.
    table: createResizableTableBlockSpec(),
  },
});

export interface TabPaneHandle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDocument: () => any[];
}

// 타이핑 중에는 이 서브 에디터 안에서만 상태가 바뀌고 부모(tabGroup 블록,
// 상위 페이지 문서)로는 아무것도 전파되지 않는다 — 자동저장이 없으므로
// 굳이 매 키 입력마다 동기화할 이유가 없다. 부모는 저장 버튼을 누르거나
// 탭을 전환/삭제하는 시점에만 getDocument()로 현재 내용을 "당겨"간다.
const TabPane = forwardRef<
  TabPaneHandle,
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any[];
    isEditable: boolean;
    // TEMP DIAGNOSTIC — 로그에서 "탭: <제목>"으로 구분하기 위한 이름표.
    label: string;
    // 이 TabPane이 속한 tabGroup 블록의 id. 안전망(dragStateRegistry)이 "이 라이브
    // 서브 에디터가 어느 tabGroup의 현재 활성 탭인지"를 알아야, 그 tabGroup의 비활성
    // 탭들(라이브 에디터가 없는)까지 포함해서 정확하게 블록 존재 여부를 판정할 수 있다.
    tabGroupBlockId: string;
  }
>(function TabPane({ content, isEditable, label, tabGroupBlockId }, ref) {
  const subEditor = useCreateBlockNote({
    schema: tabContentSchema,
    initialContent: content.length > 0 ? content : undefined,
  });

  useImperativeHandle(ref, () => ({ getDocument: () => subEditor.document }), [subEditor]);

  // 탭 서브 에디터는 평소 부모 문서와 분리돼 있어(위 flushActivePane 관련 주석 참고)
  // 타이핑해도 메인 에디터의 onChange가 울리지 않는다 — 저장 버튼이 "저장 필요"로
  // 즉시 바뀌려면 여기서도 별도로 dirty를 알려야 한다.
  const markDirty = useMarkEditorDirty();
  useEffect(() => {
    if (!markDirty) return;
    return subEditor.onChange(() => markDirty());
  }, [subEditor, markDirty]);

  // 이 서브 에디터도 전역 드래그 상태 정리 대상으로 등록한다 — 자세한 이유는
  // dragStateRegistry.ts 참고(중단된 드래그의 pmView.dragging/isDragOrigin 잔여 상태가
  // 다음 드래그로 새어 들어가는 것을 막는다).
  useEffect(
    () => registerDragStateEditor(subEditor, `탭: ${label}`, tabGroupBlockId),
    [subEditor, label, tabGroupBlockId],
  );

  // BlockNote 코어의 복사 핸들러(copyToClipboard)는 checkIfSelectionInNonEditableBlock으로
  // window.getSelection()의 조상을 타고 올라가며 contenteditable="false"를 찾는데, 멈추는
  // 지점 없이 끝까지 올라간다. 탭(tabGroup) 블록은 content:"none" 커스텀 블록이라 BlockNote가
  // 자동으로 감싸는 ".react-renderer" 래퍼 자체가 contenteditable="false"이고, 그 위에서
  // TabPane은 완전히 독립된(진짜 contenteditable="true"인) 서브 에디터인데도 그 위쪽의 false를
  // 발견해버려 "편집 불가능한 영역 안"으로 잘못 판단한다. 그러면 리치 복사(blocknote/html,
  // 표 구조 보존)를 건너뛰고 브라우저 기본 복사(순수 텍스트, 표 구조 소실)로 떨어진다.
  // capture 단계에서 우리가 직접 가로채(view.dom에 addEventListener(..., true)) 이 오탐을
  // 우회한다 — capture는 같은 엘리먼트의 bubble(=PM 자체 핸들러)보다 항상 먼저 실행되므로,
  // stopImmediatePropagation으로 BlockNote의 핸들러가 아예 호출되지 않게 막고 동일한 로직을
  // (공개 API인 selectedFragmentToHTML로) 직접 수행한다.
  useEffect(() => {
    const view = subEditor.prosemirrorView;
    if (!view) return;

    const handleCopyOrCut = (e: ClipboardEvent) => {
      if (view.state.selection.empty) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      e.clipboardData!.clearData();

      const { clipboardHTML, externalHTML, markdown } = selectedFragmentToHTML(view, subEditor);
      e.clipboardData!.setData("blocknote/html", clipboardHTML);
      e.clipboardData!.setData("text/html", externalHTML);
      e.clipboardData!.setData("text/plain", markdown);

      if (e.type === "cut" && view.editable) {
        subEditor.transact((tr) => tr.deleteSelection());
      }
    };

    view.dom.addEventListener("copy", handleCopyOrCut, true);
    view.dom.addEventListener("cut", handleCopyOrCut, true);
    return () => {
      view.dom.removeEventListener("copy", handleCopyOrCut, true);
      view.dom.removeEventListener("cut", handleCopyOrCut, true);
    };
  }, [subEditor]);

  // TEMP DIAGNOSTIC — 탭 안 표 셀에서 간헐적으로 한글 등 조합형 입력이 깨지는(자소가
  // 확정되지 않고 그대로 쌓이거나, 백스페이스가 화면에 반영 안 되는) 버그를 재현하기 위한
  // 임시 진단 로그. compositionstart/update/end, beforeinput/input을 전부 기록하고,
  // compositionend 직후 "화면(DOM)에 보이는 텍스트"와 "ProseMirror가 실제로 들고 있는
  // 문서 텍스트"를 비교해 어긋나면 즉시 표시한다 — 렌더링이 실제 상태보다 뒤처지는지
  // 여부를 직접 확인하기 위함. 원인 확정 후 dragDebugLog.ts와 함께 제거할 것.
  useEffect(() => {
    const view = subEditor.prosemirrorView;
    if (!view) return;

    const describeTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return "target=?";
      }
      const cell = target.closest("td, th");
      const block = target.closest('[data-node-type="blockContainer"]');
      return `탭=${label} cell=${cell ? "예" : "아니오"} block=${block?.getAttribute("data-id") ?? "?"}`;
    };

    const onCompositionStart = (e: CompositionEvent) => {
      dndLog("ime-compositionstart", `${describeTarget(e.target)} data="${e.data}"`);
    };
    const onCompositionUpdate = (e: CompositionEvent) => {
      dndLog("ime-compositionupdate", `${describeTarget(e.target)} data="${e.data}"`);
    };
    const onCompositionEnd = (e: CompositionEvent) => {
      dndLog("ime-compositionend", `${describeTarget(e.target)} data="${e.data}"`);
      // compositionend가 브라우저의 실제 DOM 반영보다 먼저 fire할 수 있으므로, 다음
      // 마이크로태스크로 미뤄서 비교한다.
      queueMicrotask(() => {
        try {
          const target = e.target;
          if (!(target instanceof Node)) {
            return;
          }
          const cellEl = (target instanceof Element ? target : target.parentElement)?.closest("td, th, p, [data-node-type='blockContent']");
          const domText = (cellEl ?? target).textContent ?? "";
          const pos = view.posAtDOM(target, 0);
          const $pos = view.state.doc.resolve(pos);
          const pmText = $pos.parent.textContent;
          if (domText !== pmText) {
            dndLog("ime-desync", `${describeTarget(e.target)} DOM="${domText}" PM="${pmText}"`);
          }
        } catch {
          // posAtDOM은 분리되었거나 애매한 노드에 대해 던질 수 있다 — 진단 목적상 무시.
        }
      });
    };
    const onBeforeInput = (e: InputEvent) => {
      dndLog("beforeinput", `${describeTarget(e.target)} inputType=${e.inputType} data="${e.data}" isComposing=${e.isComposing}`);
    };
    const onInput = (e: InputEvent) => {
      dndLog("input", `${describeTarget(e.target)} inputType=${e.inputType} data="${e.data}" isComposing=${e.isComposing}`);
    };

    view.dom.addEventListener("compositionstart", onCompositionStart);
    view.dom.addEventListener("compositionupdate", onCompositionUpdate);
    view.dom.addEventListener("compositionend", onCompositionEnd);
    view.dom.addEventListener("beforeinput", onBeforeInput as EventListener);
    view.dom.addEventListener("input", onInput as EventListener);
    return () => {
      view.dom.removeEventListener("compositionstart", onCompositionStart);
      view.dom.removeEventListener("compositionupdate", onCompositionUpdate);
      view.dom.removeEventListener("compositionend", onCompositionEnd);
      view.dom.removeEventListener("beforeinput", onBeforeInput as EventListener);
      view.dom.removeEventListener("input", onInput as EventListener);
    };
  }, [subEditor, label]);

  // 탭 안 표/블록을 밖(메인 에디터·다른 탭)으로 드래그하기 위한 자체 드래그 핸들.
  //
  // BlockNote 코어의 SideMenu(hover 시 왼쪽에 뜨는 grip 핸들)는 여러 에디터가 같은 페이지에
  // 있을 때 "커서에서 가장 가까운 에디터"를 찾아(SideMenu.ts의 findClosestEditorElement)
  // 그 에디터의 SideMenuView만 자신의 핸들을 보여주는데, 거리 계산이 각 에디터의 bounding box
  // 기준이라 이 탭처럼 서브 에디터가 메인 에디터 "안에" 중첩된 경우 두 에디터 모두 거리 0으로
  // 동률이 나고, 동률일 땐 document 안에서 먼저 나오는(=항상 메인) 에디터가 이긴다. 그 결과
  // 탭 안 콘텐츠를 호버해도 서브 에디터 자신의 SideMenu는 절대 뜨지 않는다 — 중첩 에디터를
  // 상정하지 않은 BlockNote 자체의 한계라 이벤트 재전달만으로는 못 고친다.
  //
  // 대신 "어떤 블록을 호버 중인지"만 직접 추적해서 자체 grip 버튼을 그리고, 실제 드래그 동작은
  // BlockNote가 이미 제공하는 공개 API인 SideMenuExtension의 blockDragStart/blockDragEnd를
  // 그대로 호출한다 — dataTransfer 구성, NodeSelection 지정, 드롭 성공 시 원본 삭제(이동)
  // 처리까지 전부 BlockNote 자신의 검증된 로직을 재사용하는 것이고, 우리가 새로 만드는 건
  // "언제 handle을 보여줄지" 판단 부분뿐이다.
  const [hoveredBlock, setHoveredBlock] = useState<{ id: string; top: number; left: number } | null>(null);
  const paneWrapperRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLDivElement>(null);
  const dragOriginRef = useRef(false);

  // "기본" 표 아래 전체를 하나로 묶는 접기/펼치기. 순수하게 CSS display로만 감추고
  // 서브 에디터의 문서(subEditor.document)나 블록 스키마는 전혀 건드리지 않는다 —
  // 드래그 세이프티넷·IME 동기화 이슈가 이 서브 에디터에서 반복됐던 이력이 있어서
  // (드래그 상태 레지스트리, compositionupdate 격리 등 위 코드 참고), 문서 모델을
  // 바꾸는 방식 대신 렌더링 결과 위에 얹는 방식을 택했다. 탭을 전환하면 이 TabPane
  // 자체가 (부모의 key={activeTab}에 의해) 언마운트/재마운트되므로 collapsed 상태는
  // 탭마다 항상 독립적으로 초기화된다.
  const [collapsed, setCollapsed] = useState(true);
  const [accordion, setAccordion] = useState(() => computeAccordionSection(subEditor.document));
  const accordionScopeId = useId();

  useEffect(() => {
    const recompute = () => setAccordion(computeAccordionSection(subEditor.document));
    recompute();
    // 편집 중 "기본" 아래에 표/섹션을 추가·삭제해도 즉시 다시 계산해 묶음에 반영한다.
    return subEditor.onChange(() => recompute());
  }, [subEditor]);

  // TEMP DIAGNOSTIC — 그립(드래그 핸들)이 켜지고/꺼지는 순간을 타임스탬프와 함께 로그로
  // 남긴다. 실제 드래그를 시도했는데 그립이 예상과 다른 타이밍에 사라지는지 확인하는 용도.
  const prevHoveredIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevHoveredIdRef.current;
    const currId = hoveredBlock?.id ?? null;
    if (prevId !== currId) {
      if (currId) {
        dndLog("grip-hover-on", `탭=${label} block=${currId}`);
      } else {
        dndLog("grip-hover-off", `탭=${label} prevBlock=${prevId ?? "?"}`);
      }
      prevHoveredIdRef.current = currId;
    }
  }, [hoveredBlock, label]);

  // 안전장치: grip을 눌렀다가(mousedown) 실제로는 드래그하지 않고 그냥 놓은 경우
  // dragstart/dragend가 아예 발생하지 않을 수 있다 — 그러면 dragOriginRef가 true로 영영
  // 남아 호버 추적이 계속 멈춰있게 된다. mouseup은 클릭이든 드래그 종료든 항상 일어나므로
  // 여기서 한 번 더 풀어준다.
  useEffect(() => {
    const onGlobalMouseUp = () => {
      dragOriginRef.current = false;
    };
    document.addEventListener("mouseup", onGlobalMouseUp);
    return () => document.removeEventListener("mouseup", onGlobalMouseUp);
  }, []);

  // grip은 실제 블록 콘텐츠 왼쪽 바깥(음수 left)에 절대 위치로 겹쳐 그려지는데, 그 사이에는
  // 그립도 아니고 블록 콘텐츠도 아닌 좁은 틈(gutter)이 있다. 예전 구현은 view.dom에만
  // mousemove/mouseleave를 붙이고 elementFromPoint로 "정확히 그 픽셀 위 엘리먼트"를 찾았는데,
  // 커서가 그 틈을 지나는 순간(블록→그립으로 옆으로 살짝만 움직여도) elementFromPoint가
  // 그립도 블록도 아닌 제3의 엘리먼트(빈 여백)를 돌려주면서 hoveredBlock이 즉시 null이 되어
  // 그립이 사라져버렸다 — 그립을 클릭하기도 전에 꺼지는 문제였다. 대신 각 블록의
  // getBoundingClientRect()를 직접 스캔해 "블록의 세로 범위 안 + 블록 왼쪽 끝에서 그립을
  // 넉넉히 포함하는 가로 범위 안"이면 무조건 같은 블록으로 판정하는 좌표 기반 히트테스트로
  // 바꾼다. 그립과 블록 사이의 틈이 이 히트박스 안에 통째로 포함되므로 더 이상 끊기지 않는다.
  const GUTTER_PX = 32; // 그립 폭(16px) + 그립 오프셋(20px) + 여유(약간의 버퍼)를 넉넉히 덮는다.

  const updateHoverFromPoint = (clientX: number, clientY: number) => {
    // 드래그가 진행 중일 때는 호버 상태를 건드리지 않는다 — 안 그러면 드래그 중 커서가
    // 그립 버튼 바깥(예: 실제로 옮기려는 표 위)으로 움직이는 순간 hoveredBlock이 바뀌거나
    // null이 되면서 이 grip 엘리먼트가 리렌더로 사라져, 브라우저가 진행 중이던 네이티브
    // 드래그를 그 자리에서 취소해버린다.
    if (dragOriginRef.current) {
      return;
    }
    const view = subEditor.prosemirrorView;
    const wrapper = paneWrapperRef.current;
    if (!view || !wrapper) {
      return;
    }
    const containers = view.dom.querySelectorAll('[data-node-type="blockContainer"]');
    let best: { id: string; rect: DOMRect } | null = null;
    for (const el of containers) {
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top || clientY > rect.bottom) {
        continue;
      }
      if (clientX < rect.left - GUTTER_PX || clientX > rect.right) {
        continue;
      }
      // 여러 블록이 겹쳐 매치되면(중첩 블록 등) 세로 폭이 가장 좁은, 즉 가장 안쪽 블록을 우선한다.
      if (!best || rect.height < best.rect.height) {
        const id = el.getAttribute("data-id");
        if (id) {
          best = { id, rect };
        }
      }
    }
    if (!best) {
      setHoveredBlock(null);
      return;
    }
    const wrapperRect = wrapper.getBoundingClientRect();
    setHoveredBlock({
      id: best.id,
      top: best.rect.top - wrapperRect.top,
      left: best.rect.left - wrapperRect.left,
    });
  };

  // 위 히트테스트를 실제로 구동하는 좌표 소스. wrapper나 view.dom에 이벤트를 붙이면 그
  // 엘리먼트 "자기 자신의 레이아웃 박스"를 벗어나는 순간(그립이 절대 위치·음수 offset으로
  // 그 박스 바깥에 겹쳐 그려지는 경우 포함) 브라우저가 mouseleave를 먼저 쏴버릴 수 있어
  // DOM 계층 구조에 좌우된다. 그 대신 document 레벨에서 좌표만 계속 흘려받고, "이 탭
  // 페인의 영역(그립 여유폭 포함) 안인가"는 위 updateHoverFromPoint의 순수 좌표 비교로만
  // 판정한다 — 어떤 엘리먼트가 그 픽셀을 그렸는지와 무관하게 항상 일관되게 동작한다.
  //
  // ⚠️ capture 단계(true)로 등록해야 한다 — 아래 forwardMouseEvent(wrapper의 bubble 단계
  // onMouseMove)와 그립 자신의 onMouseMove가 둘 다 e.stopPropagation()을 호출해서(표
  // 리사이즈·TableHandles 재전달 로직과의 충돌을 막기 위함), bubble 단계로 등록하면 탭
  // 페인 내부에서 일어나는 mousemove 대부분이 이 리스너에 아예 도달하지 못해 그립이
  // 영영 나타나지 않는다. capture는 그 stopPropagation보다 먼저(하강 단계에) 실행되므로
  // 항상 좌표를 받는다.
  useEffect(() => {
    const onDocMouseMove = (e: MouseEvent) => {
      if (dragOriginRef.current) {
        return;
      }
      const wrapper = paneWrapperRef.current;
      if (!wrapper) {
        return;
      }
      const wrapperRect = wrapper.getBoundingClientRect();
      // 이 탭 페인의 세로 범위 + (그립을 포함하는) 가로 범위를 완전히 벗어났으면 빠르게
      // hoveredBlock을 지운다 — 그 안이면 정확한 블록은 updateHoverFromPoint가 판정한다.
      if (
        e.clientY < wrapperRect.top ||
        e.clientY > wrapperRect.bottom ||
        e.clientX < wrapperRect.left - GUTTER_PX ||
        e.clientX > wrapperRect.right
      ) {
        setHoveredBlock(null);
        return;
      }
      updateHoverFromPoint(e.clientX, e.clientY);
    };
    document.addEventListener("mousemove", onDocMouseMove, true);
    return () => document.removeEventListener("mousemove", onDocMouseMove, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subEditor]);

  // mousemove/mouseup을 부모 에디터로 그냥 버블링시키면 BlockNote의 TableHandles 확장이
  // pmView.dom(부모 에디터 루트 엘리먼트)에 달아둔 "bubble 단계" mousemove 리스너가 이 이벤트를
  // 받아 서브 에디터 내부 block id를 부모 문서에서 찾다가 "Block with ID ... not found" 예외를
  // 던진다 — 그래서 stopPropagation으로 원본 이벤트의 버블링 자체는 막는다.
  //
  // 하지만 표 컬럼/행 리사이즈(window.addEventListener, bubble/target 단계)와 표 셀 호버·
  // 드래그-선택을 담당하는 TableHandlesController(같은 view.dom에 직접 붙는 리스너라 애초에
  // stopPropagation의 영향을 안 받음, 재전달과 무관)는 정상 동작하려면 window/document에
  // 다시 이벤트가 필요하다. 아래 두 디스패치로 나눠 재현한다:
  //  1) window 자신을 target으로 디스패치 — resize가 window에서 직접 받는 이벤트라 이걸로 충분.
  //  2) 실제 커서 아래 엘리먼트(document.elementFromPoint)를 target으로, bubbles:false로 디스패치.
  //     capture 단계로 등록된 document 레벨 리스너들은 여전히 받지만(캡처링은 bubbles 여부와
  //     무관하게 항상 일어남), bubble 단계로 등록된 부모 TableHandles의 pmView.dom 리스너는
  //     받지 않는다. (단, BlockNote의 SideMenu 자체는 이렇게 이벤트가 정상 도달해도 여러 에디터
  //     중 "가장 가까운 에디터"를 고르는 자체 로직 때문에 중첩 에디터에서는 뜨지 않는다 — 그건
  //     아래 hoveredBlock 기반의 자체 드래그 핸들로 별도 해결한다.)
  const forwardMouseEvent = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shared = {
      cancelable: true,
      view: window,
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      button: e.button,
      buttons: e.buttons,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
    };
    window.dispatchEvent(new MouseEvent(e.type, { ...shared, bubbles: false }));

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (target) {
      target.dispatchEvent(new MouseEvent(e.type, { ...shared, bubbles: false }));
    }
  };

  return (
    <div
      ref={paneWrapperRef}
      className="relative"
      data-tabpane-accordion-scope={accordionScopeId}
      // 이 안에서 일어나는 타이핑/조합(IME)/클릭 이벤트가 부모 에디터로
      // 버블링되어 부모의 "/" 슬래시 메뉴나 키맵과 충돌하지 않도록 막는다.
      // (content:"none" 블록 안의 실제 contentEditable 영역은 BlockNote
      // 노드뷰의 기본 stopEvent로도 걸러지지만, 이중 안전장치로 둔다.)
      //
      // ⚠️ onCompositionUpdate가 예전엔 빠져 있었다 — 한글 등 조합형 입력은
      // compositionstart 한 번, 그 뒤 글자마다 compositionupdate가 반복해서 발생하고
      // compositionend로 확정되는데, start/end만 막고 update를 그대로 버블링시키면
      // 조합이 진행되는 동안 이 이벤트가 계속 부모 에디터(React 트리 전체)로 새어나가
      // 부모 쪽에서 이 조합 세션을 엉뚱하게 관찰/개입할 여지가 생긴다. 특히 빠른 타이핑
      // 중 backspace(keydown, 이건 이미 막고 있었음)와 compositionupdate가 겹치는
      // 타이밍에 조합이 확정되지 않고 자소가 그대로 쌓이는 증상과 일치해 함께 막는다.
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onBeforeInput={(e) => e.stopPropagation()}
      onCompositionStart={(e) => e.stopPropagation()}
      onCompositionUpdate={(e) => e.stopPropagation()}
      onCompositionEnd={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={forwardMouseEvent}
      onMouseUp={forwardMouseEvent}
    >
      <BlockNoteView editor={subEditor} theme="light" editable={isEditable} />
      {accordion.anchorBlockId && accordion.hiddenBlockIds.length > 0 && (
        <>
          {collapsed && (
            <style>{`${accordion.hiddenBlockIds
              .map(
                (id) =>
                  `[data-tabpane-accordion-scope="${accordionScopeId}"] [data-node-type="blockContainer"][data-id="${id}"]`,
              )
              .join(",\n")} { display: none !important; }`}</style>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="my-1 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            {collapsed ? "자세히 보기 +" : "접기 -"}
          </button>
        </>
      )}
      {isEditable && (
        <div
          ref={gripRef}
          // 네이티브 HTML5 드래그는 이벤트를 처음 받은(dragstart) DOM 엘리먼트를 그 드래그의
          // "소스"로 계속 참조한다. hoveredBlock이 null이 될 때마다(다른 블록으로 이동, 탭
          // 밖으로 이탈 등) 이 엘리먼트를 조건부 렌더로 언마운트했다가 재마운트하면, 드래그가
          // 진행되는 도중에라도 그 소스 엘리먼트가 DOM에서 사라지는 순간이 생길 수 있고,
          // 브라우저에 따라 이를 드래그 중단으로 처리할 위험이 있다. 그래서 엘리먼트 자체는
          // 항상 마운트해두고, 보이는지/드래그 가능한지만 hoveredBlock 유무로 토글한다.
          draggable={!!hoveredBlock}
          title="블록 이동"
          // mousedown 시점부터(= 실제 dragstart가 발생하기 전, 임계 이동 구간부터) 얼려둔다.
          // 그렇지 않으면 그 사이의 미세한 mousemove가 hoveredBlock을 바꾸거나 null로 만들어
          // 이 grip의 위치/가시성이 리렌더로 바뀌고, 드래그 소스 취급이 흔들릴 수 있다.
          onMouseDown={() => {
            dragOriginRef.current = true;
          }}
          onDragStart={(e) => {
            if (!hoveredBlock) {
              e.preventDefault();
              return;
            }
            const block = subEditor.getBlock(hoveredBlock.id);
            const sideMenu = subEditor.getExtension(SideMenuExtension);
            if (!block || !sideMenu) return;
            sideMenu.blockDragStart(e, block);
          }}
          onDragEnd={() => {
            subEditor.getExtension(SideMenuExtension)?.blockDragEnd();
            dragOriginRef.current = false;
            setHoveredBlock(null);
          }}
          // 드래그 핸들 자체는 클릭/커서 이동 대상이 아니므로, hover 추적에 쓰는 mousemove
          // 재전달(forwardMouseEvent)이 이 엘리먼트 위에서는 반복 트리거되지 않게 막는다.
          onMouseMove={(e) => e.stopPropagation()}
          className="absolute z-10 flex h-5 w-4 items-center justify-center rounded text-[var(--fg-muted)] hover:bg-[var(--hover)] active:cursor-grabbing"
          style={
            hoveredBlock
              ? { top: hoveredBlock.top, left: hoveredBlock.left - 20, cursor: "grab" }
              : { top: -9999, left: -9999, pointerEvents: "none", visibility: "hidden" }
          }
        >
          ⠿
        </div>
      )}
    </div>
  );
});

function TabGroupRenderer({
  block,
  editor,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
}) {
  const tabs = parseTabs(block.props.tabs as string);
  const activeTab = Math.min(Math.max(block.props.activeTab as number, 0), tabs.length - 1);
  const paneRef = useRef<TabPaneHandle | null>(null);
  const registryRef = useTabSyncRegistry();

  const save = (nextTabs: TabItem[], nextActive: number = activeTab) => {
    editor.updateBlock(block.id, {
      props: { tabs: JSON.stringify(nextTabs), activeTab: nextActive },
    });
  };

  // 지금 화면에 떠 있는 활성 탭 서브 에디터의 최신 내용을 tabs 배열에 반영한
  // 새 배열을 돌려준다. 탭 전환/삭제/저장처럼 서브 에디터가 사라지거나
  // 문서 전체를 읽어야 하는 시점에만 호출한다(타이핑 중에는 호출되지 않음).
  const flushActivePane = (): TabItem[] => {
    if (!paneRef.current) return tabs;
    const content = paneRef.current.getDocument();
    return tabs.map((t, i) => (i === activeTab ? { ...t, content } : t));
  };

  // 저장 버튼을 누르면 BlockEditor가 등록된 모든 tabGroup의 이 콜백을
  // 순서대로 호출해, 그제서야 활성 탭 내용을 블록 prop에 반영한다.
  useEffect(() => {
    if (!registryRef) return;
    const registry = registryRef.current;
    registry.set(block.id, () => {
      const flushed = flushActivePane();
      editor.updateBlock(block.id, { props: { tabs: JSON.stringify(flushed) } });
    });
    return () => {
      registry.delete(block.id);
    };
  });

  const switchTab = (index: number) => {
    save(flushActivePane(), index);
  };

  const renameTab = (index: number, title: string) => {
    save(tabs.map((t, i) => (i === index ? { ...t, title } : t)));
  };

  const addTab = () => {
    const flushed = flushActivePane();
    const next = [...flushed, { title: `탭 ${flushed.length + 1}`, content: [] }];
    save(next, next.length - 1);
  };

  const removeTab = (index: number) => {
    if (tabs.length <= 1) return;
    const flushed = flushActivePane();
    const next = flushed.filter((_, i) => i !== index);
    save(next, Math.min(activeTab, next.length - 1));
  };

  return (
    <div className="my-1 w-full">
      {/* 탭 바(제목/추가/삭제 버튼)만 contentEditable=false로 둔다 — 아래 TabPane은
          자기 자신이 완전히 별도의(제대로 contentEditable=true인) BlockNote 서브 에디터라,
          이 바깥까지 통째로 false로 감싸면 BlockNote 코어의 checkIfSelectionInNonEditableBlock
          (복사 시 window.getSelection()에서 조상을 타고 올라가며 contenteditable="false"를
          찾는 로직)이 서브 에디터 자신의 true 경계를 무시하고 이 바깥 false까지 올라가버려,
          탭 안에서 복사할 때마다 BlockNote의 리치 복사(표 구조 보존)가 아니라 브라우저 기본
          텍스트 복사로 떨어지는 문제가 있었다. */}
      <div contentEditable={false} className="flex items-center gap-0.5 overflow-x-auto">
        {tabs.map((tab, i) => {
          const isActive = i === activeTab;
          return (
            <div key={i} className="group relative flex shrink-0 items-center">
              {isActive && editor.isEditable ? (
                // 그리드 두 칸을 같은 셀(col/row 1)에 겹쳐서, 보이지 않는
                // span이 실제 렌더링 폭(한글 등 non-Latin 글자 포함)만큼
                // 트랙 크기를 정하고 input이 그 폭에 꽉 차게 늘어나도록 한다.
                // "ch" 단위는 반각 기준이라 한글 라벨에서 폭이 부족해 잘렸었다.
                <div className="grid">
                  <span
                    aria-hidden
                    className="invisible col-start-1 row-start-1 whitespace-nowrap px-4 py-2 text-sm font-medium"
                  >
                    {tab.title || " "}
                  </span>
                  <input
                    value={tab.title}
                    onChange={(e) => renameTab(i, e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    size={1}
                    className="col-start-1 row-start-1 min-w-0 w-full border-b-2 border-[var(--accent)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--accent)] outline-none"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => switchTab(i)}
                  className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  {tab.title}
                </button>
              )}
              {editor.isEditable && tabs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTab(i)}
                  title="탭 삭제"
                  className="-ml-1 hidden h-4 w-4 shrink-0 items-center justify-center rounded text-xs text-[var(--fg-muted)] hover:text-red-500 group-hover:flex"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {editor.isEditable && (
          <button
            type="button"
            onClick={addTab}
            title="탭 추가"
            className="shrink-0 border-b-2 border-transparent px-3 py-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            +
          </button>
        )}
      </div>
      <div contentEditable={false} className="border-b border-[var(--border)]" />
      <div className="pt-3">
        <TabPane
          key={activeTab}
          ref={paneRef}
          content={tabs[activeTab]?.content ?? []}
          isEditable={!!editor.isEditable}
          label={tabs[activeTab]?.title ?? `탭 ${activeTab + 1}`}
          tabGroupBlockId={block.id}
        />
      </div>
    </div>
  );
}

const TabGroupSpecFactory = createReactBlockSpec(
  {
    type: "tabGroup" as const,
    propSchema: {
      // TabItem[] 을 JSON 문자열로 저장 — pricingCards의 packages와 같은 이유.
      tabs: { default: JSON.stringify(DEFAULT_TABS) },
      // 마지막으로 보던 탭 인덱스. 페이지를 다시 열어도 유지된다.
      activeTab: { default: 0 },
    },
    content: "none" as const,
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => <TabGroupRenderer block={block} editor={editor} />,
  }
);

export const tabGroupSpec = TabGroupSpecFactory();
