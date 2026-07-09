"use client";

import { createReactBlockSpec, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
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
    <div contentEditable={false} className="my-1 w-full">
      <div className="flex items-center gap-0.5 overflow-x-auto">
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
      <div className="border-b border-[var(--border)]" />
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
