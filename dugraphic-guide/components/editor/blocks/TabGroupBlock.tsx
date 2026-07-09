"use client";

import { createReactBlockSpec, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultBlockSpecs, selectedFragmentToHTML } from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import "@blocknote/mantine/style.css";
import type React from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTabSyncRegistry } from "../tabSyncContext";
import { createResizableTableBlockSpec } from "./ResizableTableBlock";

// BlockNote 코어의 getDraggableBlockFromElement(extensions/getDraggableBlockFromElement.ts)와
// 동일한 로직 — export되지 않아 그대로 옮겨왔다. 커서 아래 DOM 엘리먼트에서 가장 가까운
// "블록 하나" 단위(data-node-type="blockContainer")를 찾는다.
function getDraggableBlockFromElement(
  element: Element | null,
  viewDom: HTMLElement,
): { node: HTMLElement; id: string } | undefined {
  let el = element;
  while (
    el &&
    el.parentElement &&
    el.parentElement !== viewDom &&
    el.getAttribute?.("data-node-type") !== "blockContainer"
  ) {
    el = el.parentElement;
  }
  if (!el || el.getAttribute?.("data-node-type") !== "blockContainer") {
    return undefined;
  }
  const id = el.getAttribute("data-id");
  return id ? { node: el as HTMLElement, id } : undefined;
}

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
  }
>(function TabPane({ content, isEditable }, ref) {
  const subEditor = useCreateBlockNote({
    schema: tabContentSchema,
    initialContent: content.length > 0 ? content : undefined,
  });

  useImperativeHandle(ref, () => ({ getDocument: () => subEditor.document }), [subEditor]);

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

  useEffect(() => {
    const view = subEditor.prosemirrorView;
    const wrapper = paneWrapperRef.current;
    if (!view || !wrapper) return;

    const updateFromPoint = (clientX: number, clientY: number) => {
      // 드래그가 진행 중일 때는 호버 상태를 건드리지 않는다 — 안 그러면 드래그 중
      // 커서가 grip 버튼 바깥(예: 실제로 옮기려는 표 위)으로 움직이는 순간 hoveredBlock이
      // 바뀌거나 null이 되면서 이 grip 엘리먼트가 리렌더로 사라져, 브라우저가 진행 중이던
      // 네이티브 드래그를 그 자리에서 취소해버린다(드래그 소스 엘리먼트가 DOM에서 없어지면
      // dragstart 자체가 발생하지 않거나 드래그가 중단된다).
      if (dragOriginRef.current) {
        return;
      }
      const target = document.elementFromPoint(clientX, clientY);
      // grip 자신은 실제 블록 콘텐츠 바로 왼쪽(음수 left)에 절대 위치로 겹쳐 그려지므로,
      // 커서가 grip 위에 있을 때 elementFromPoint는 그 아래 블록이 아니라 grip 자신을
      // 돌려준다. 그걸 "호버할 블록 없음"으로 오인해 grip을 지워버리면(리렌더로 사라짐)
      // 커서가 grip에 닿는 순간 자기 자신이 사라지는 자기모순이 생긴다 — 이 경우는 그냥
      // 지금 hoveredBlock을 그대로 유지한다.
      if (target && gripRef.current && (target === gripRef.current || gripRef.current.contains(target))) {
        return;
      }
      const found = target && getDraggableBlockFromElement(target, view.dom);
      if (!found) {
        setHoveredBlock(null);
        return;
      }
      const rect = found.node.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      setHoveredBlock({
        id: found.id,
        top: rect.top - wrapperRect.top,
        left: rect.left - wrapperRect.left,
      });
    };

    const onMove = (e: MouseEvent) => updateFromPoint(e.clientX, e.clientY);
    const onLeave = (e: MouseEvent) => {
      if (dragOriginRef.current) {
        return;
      }
      // grip은 view.dom의 형제(sibling)로 그 바깥에 절대 위치로 그려지므로, 커서가 표
      // 안쪽에서 grip 쪽으로 움직이면 "view.dom을 벗어났다"는 네이티브 mouseleave가 먼저
      // 뜬다. relatedTarget(= 커서가 지금 향하는 엘리먼트)이 grip 자신이면, 그건 실제로
      // grip에 도달한 것뿐이니 hoveredBlock을 지우지 않는다 — 지우면 커서가 grip에 닿는
      // 순간 grip 자신이 리렌더로 사라지는 자기모순이 생긴다.
      const related = e.relatedTarget as Node | null;
      if (related && gripRef.current && (related === gripRef.current || gripRef.current.contains(related))) {
        return;
      }
      setHoveredBlock(null);
    };

    // view.dom 자체에 붙인다 — TabPane 바깥 div의 stopPropagation보다 더 안쪽(자손)이라
    // 그 stopPropagation과 무관하게 정상적으로 받는다(표 리사이즈·복사와 같은 이유).
    view.dom.addEventListener("mousemove", onMove);
    view.dom.addEventListener("mouseleave", onLeave);
    return () => {
      view.dom.removeEventListener("mousemove", onMove);
      view.dom.removeEventListener("mouseleave", onLeave);
    };
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
      // 이 안에서 일어나는 타이핑/조합(IME)/클릭 이벤트가 부모 에디터로
      // 버블링되어 부모의 "/" 슬래시 메뉴나 키맵과 충돌하지 않도록 막는다.
      // (content:"none" 블록 안의 실제 contentEditable 영역은 BlockNote
      // 노드뷰의 기본 stopEvent로도 걸러지지만, 이중 안전장치로 둔다.)
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onBeforeInput={(e) => e.stopPropagation()}
      onCompositionStart={(e) => e.stopPropagation()}
      onCompositionEnd={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={forwardMouseEvent}
      onMouseUp={forwardMouseEvent}
    >
      <BlockNoteView editor={subEditor} theme="light" editable={isEditable} />
      {isEditable && hoveredBlock && (
        <div
          ref={gripRef}
          draggable
          title="블록 이동"
          // mousedown 시점부터(= 실제 dragstart가 발생하기 전, 임계 이동 구간부터) 얼려둔다.
          // 그렇지 않으면 그 사이의 미세한 mousemove가 hoveredBlock을 바꾸거나 null로 만들어
          // 이 grip 엘리먼트를 리렌더로 없애버리고, 드래그 소스가 사라지면서 브라우저가
          // dragstart 자체를 내지 않거나 드래그를 중단시킨다.
          onMouseDown={() => {
            dragOriginRef.current = true;
          }}
          onDragStart={(e) => {
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
          className="absolute z-10 flex h-5 w-4 cursor-grab items-center justify-center rounded text-[var(--fg-muted)] hover:bg-[var(--hover)] active:cursor-grabbing"
          style={{ top: hoveredBlock.top, left: hoveredBlock.left - 20 }}
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
