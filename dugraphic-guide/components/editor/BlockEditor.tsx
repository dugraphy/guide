"use client";

import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "./blocknote-overrides.css";
import { useRef, useCallback, useEffect, useState } from "react";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import type { PageData } from "@/lib/data";
import { pageLinkSpec } from "./blocks/PageLinkBlock";
import { todoSpec } from "./blocks/TodoBlock";
import { pricingCardsSpec } from "./blocks/PricingCardsBlock";
import { calloutBoxSpec } from "./blocks/CalloutBoxBlock";
import type { TemplateRow } from "@/lib/templates";

// Custom schema — defined at module level so the reference stays stable across renders
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    pageLink: pageLinkSpec,
    todo: todoSpec,
    pricingCards: pricingCardsSpec,
    calloutBox: calloutBoxSpec,
  },
});

function parseInitialContent(body: string) {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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

export default function BlockEditor({ page, onBodyChange, editable = true }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useCreateBlockNote({
    schema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: parseInitialContent(page.body) as any,
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
            const all = [...defaults, todoItem, pageLinkItem, ...templateItems];
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
