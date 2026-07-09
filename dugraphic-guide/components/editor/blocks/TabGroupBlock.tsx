"use client";

import { createReactBlockSpec, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultBlockSpecs, selectedFragmentToHTML } from "@blocknote/core";
import "@blocknote/mantine/style.css";
import type React from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useTabSyncRegistry } from "../tabSyncContext";
import { createResizableTableBlockSpec } from "./ResizableTableBlock";

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

  // mousemove/mouseup을 부모 에디터로 버블링시키면 BlockNote의 TableHandles 확장이
  // pmView.dom(부모 에디터 루트)에 달아둔 mousemove 리스너가 이 이벤트를 받아 서브 에디터
  // 내부 block id를 부모 문서에서 찾다가 "Block with ID ... not found" 예외를 던진다 —
  // 그래서 stopPropagation으로 버블링 자체는 막는다. 다만 표 컬럼 리사이즈(prosemirror-tables가
  // window에 직접 붙이는 mousemove/mouseup)와 행 리사이즈(이 파일 ResizableTableBlock.ts도
  // 동일하게 window 레벨로 듣는다)는 버블링이 아니라 각자 window.addEventListener로 드래그를
  // 추적하므로, stopPropagation만으로는 그 리스너들도 함께 막혀버린다. 그래서 원본 이벤트는
  // 막되, 좌표/버튼 상태만 복제한 새 MouseEvent를 window에 직접 dispatch해 그 리스너들에게는
  // 정상적으로 전달되게 한다 — dispatchEvent(window, ...)는 DOM 트리를 타고 올라가는 버블링이
  // 아니라 window 자신에게 바로 꽂아주는 것이라 부모의 pmView.dom 리스너는 거치지 않는다.
  const forwardToWindow = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new MouseEvent(e.type, {
        bubbles: false,
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
      }),
    );
  };

  return (
    <div
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
      onMouseMove={forwardToWindow}
      onMouseUp={forwardToWindow}
    >
      <BlockNoteView editor={subEditor} theme="light" editable={isEditable} />
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
