"use client";

import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "./blocknote-overrides.css";
import { useRef, useCallback, useEffect, useState, memo } from "react";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import type { PageData } from "@/lib/data";
import { pageLinkSpec } from "./blocks/PageLinkBlock";
import { todoSpec } from "./blocks/TodoBlock";
import { pricingCardsSpec } from "./blocks/PricingCardsBlock";
import { calloutBoxSpec } from "./blocks/CalloutBoxBlock";
import { tabGroupSpec } from "./blocks/TabGroupBlock";
import type { TemplateRow } from "@/lib/templates";

// Custom schema — defined at module level so the reference stays stable across renders
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    pageLink: pageLinkSpec,
    todo: todoSpec,
    pricingCards: pricingCardsSpec,
    calloutBox: calloutBoxSpec,
    tabGroup: tabGroupSpec,
  },
});

function parseInitialContent(body: string) {
  try {
    const parsed = JSON.parse(body);
    // 유효한 BlockNote JSON 배열이면 빈 배열([])이어도 여기서 바로 반환한다.
    // 그렇지 않으면 아래 "일반 텍스트로 취급" 분기로 넘어가 body 문자열
    // "[]"가 그대로 문단 텍스트로 표시되는 버그가 있었다.
    if (Array.isArray(parsed)) {
      return parsed.length > 0 ? parsed : undefined;
    }
  } catch {
    // not BlockNote JSON
  }
  if (body.trim()) {
    return [{ type: "paragraph", content: [{ type: "text", text: body, styles: {} }] }];
  }
  return undefined;
}

interface Props {
  page: PageData;
  onBodyChange: (body: string) => void;
  editable?: boolean;
}

function BlockEditor({ page, onBodyChange, editable = true }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  // useCreateBlockNote는 initialContent를 최초 마운트 시 1회만 사용하지만(내부적으로
  // 빈 deps의 useMemo), 인자 표현식 자체는 리렌더마다 평가된다. page.body를 그대로
  // 넘기면 부모가 리렌더될 때마다 큰 문서 전체를 JSON.parse하는 비용이 매번 낭비되므로
  // 최초 값만 한 번 계산해 재사용한다.
  const [initialContent] = useState(() => parseInitialContent(page.body));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  useEffect(() => {
    if (!editable) return;
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => {});
  }, [editable]);

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ed: BlockNoteEditor<any, any, any>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onBodyChange(JSON.stringify(ed.document));
      }, 300);
    },
    [onBodyChange]
  );

  return (
    <BlockNoteView
      editor={editor}
      onChange={handleChange}
      theme="light"
      slashMenu={false}
      editable={editable}
    >
      {editable && (
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const defaults = getDefaultReactSlashMenuItems(editor);
            const todoItem = {
              title: "할일",
              group: "기본",
              icon: <span style={{ fontSize: "1.1em" }}>✅</span>,
              onItemClick: () => {
                const pos = editor.getTextCursorPosition();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor.insertBlocks as any)(
                  [{ type: "todo", props: { checked: false, dueDate: "" } }],
                  pos.block,
                  "after"
                );
              },
            };
            const pageLinkItem = {
              title: "페이지 링크",
              group: "미디어",
              icon: <span style={{ fontSize: "1.1em" }}>🔗</span>,
              onItemClick: () => {
                const pos = editor.getTextCursorPosition();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor.insertBlocks as any)(
                  [
                    {
                      type: "pageLink",
                      props: {
                        pageSlug: "",
                        pageTitle: "",
                        pageIcon: "📄",
                        pageDescription: "",
                      },
                    },
                  ],
                  pos.block,
                  "after"
                );
              },
            };
            const tabGroupItem = {
              title: "탭",
              group: "기본",
              icon: <span style={{ fontSize: "1.1em" }}>📑</span>,
              onItemClick: () => {
                const pos = editor.getTextCursorPosition();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor.insertBlocks as any)([{ type: "tabGroup" }], pos.block, "after");
              },
            };
            const templateItems = templates.map((tpl) => ({
              title: tpl.name,
              group: "템플릿",
              icon: <span style={{ fontSize: "1.1em" }}>{tpl.icon}</span>,
              onItemClick: () => {
                const pos = editor.getTextCursorPosition();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor.insertBlocks as any)(tpl.blocks, pos.block, "after");
              },
            }));
            const all = [...defaults, todoItem, pageLinkItem, tabGroupItem, ...templateItems];
            return query
              ? all.filter((item) =>
                  item.title.toLowerCase().includes(query.toLowerCase())
                )
              : all;
          }}
        />
      )}
    </BlockNoteView>
  );
}

// 부모(PageEditorWrapper)는 저장 상태·제목 변경 등으로 자주 리렌더되는데,
// 그때마다 이 무거운 에디터(특히 큰 테이블)까지 다시 렌더링될 필요는 없다.
// page.body는 최초 마운트 이후로는 이 컴포넌트 내부에서 쓰이지 않으므로
// 얕은 비교로 건너뛰어도 안전하다.
export default memo(BlockEditor);
