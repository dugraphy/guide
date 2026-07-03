"use client";

import { createReactBlockSpec } from "@blocknote/react";

function TodoRenderer({
  block,
  editor,
  contentRef,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
  contentRef: (node: HTMLElement | null) => void;
}) {
  const { checked, dueDate } = block.props as {
    checked: boolean;
    dueDate: string;
  };

  const toggleChecked = () => {
    if (!editor.isEditable) return;
    editor.updateBlock(block.id, { props: { checked: !checked } });
  };

  const setDueDate = (value: string) => {
    editor.updateBlock(block.id, { props: { dueDate: value } });
  };

  return (
    <div className="flex items-start gap-2 w-full rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-[var(--hover)]">
      <div contentEditable={false} className="shrink-0 flex items-center h-6">
        <input
          type="checkbox"
          checked={checked}
          onChange={toggleChecked}
          disabled={!editor.isEditable}
          className="cursor-pointer"
        />
      </div>
      <div
        ref={contentRef}
        className={`flex-1 min-w-0 py-0.5 ${
          checked ? "line-through text-[var(--fg-muted)]" : ""
        }`}
      />
      <div contentEditable={false} className="shrink-0 flex items-center h-6">
        {editor.isEditable ? (
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="text-xs bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--fg-muted)] outline-none focus:border-[var(--accent)] transition-colors"
          />
        ) : (
          dueDate && (
            <span className="text-xs text-[var(--fg-muted)] px-1.5 py-0.5">
              📅 {dueDate}
            </span>
          )
        )}
      </div>
    </div>
  );
}

const TodoSpecFactory = createReactBlockSpec(
  {
    type: "todo" as const,
    propSchema: {
      checked: { default: false },
      // ISO "YYYY-MM-DD" 마감일/예정일, 빈 문자열이면 날짜 없음. 나중에
      // 퍼센테이지 계산·달력 기능에서 이 값을 그대로 파싱해 쓸 수 있도록
      // 형식을 고정해둔다.
      dueDate: { default: "" },
    },
    content: "inline" as const,
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor, contentRef }: any) => (
      <TodoRenderer block={block} editor={editor} contentRef={contentRef} />
    ),
  }
);

export const todoSpec = TodoSpecFactory();
