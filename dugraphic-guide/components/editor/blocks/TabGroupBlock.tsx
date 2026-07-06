"use client";

import { createReactBlockSpec, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import "@blocknote/mantine/style.css";

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
  blockSpecs: { ...defaultBlockSpecs },
});

function TabPane({
  content,
  isEditable,
  onContentChange,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any[];
  isEditable: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onContentChange: (blocks: any[]) => void;
}) {
  const subEditor = useCreateBlockNote({
    schema: tabContentSchema,
    initialContent: content.length > 0 ? content : undefined,
  });

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
    >
      <BlockNoteView
        editor={subEditor}
        theme="light"
        editable={isEditable}
        onChange={() => onContentChange(subEditor.document)}
      />
    </div>
  );
}

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

  const save = (nextTabs: TabItem[], nextActive: number = activeTab) => {
    editor.updateBlock(block.id, {
      props: { tabs: JSON.stringify(nextTabs), activeTab: nextActive },
    });
  };

  const switchTab = (index: number) => {
    editor.updateBlock(block.id, { props: { activeTab: index } });
  };

  const renameTab = (index: number, title: string) => {
    save(tabs.map((t, i) => (i === index ? { ...t, title } : t)));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateTabContent = (index: number, content: any[]) => {
    save(tabs.map((t, i) => (i === index ? { ...t, content } : t)));
  };

  const addTab = () => {
    const next = [...tabs, { title: `탭 ${tabs.length + 1}`, content: [] }];
    save(next, next.length - 1);
  };

  const removeTab = (index: number) => {
    if (tabs.length <= 1) return;
    const next = tabs.filter((_, i) => i !== index);
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
                <input
                  value={tab.title}
                  onChange={(e) => renameTab(i, e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="min-w-[3ch] border-b-2 border-[var(--accent)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--accent)] outline-none"
                  style={{ width: `${Math.max(tab.title.length, 2) + 1}ch` }}
                />
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
          content={tabs[activeTab]?.content ?? []}
          isEditable={!!editor.isEditable}
          onContentChange={(blocks) => updateTabContent(activeTab, blocks)}
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
