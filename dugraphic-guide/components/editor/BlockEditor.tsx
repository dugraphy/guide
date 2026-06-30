"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useRef, useCallback } from "react";
import type { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import type { PageData } from "@/lib/data";

function parseInitialContent(body: string): PartialBlock[] | undefined {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as PartialBlock[];
  } catch {
    // not BlockNote JSON
  }
  if (body.trim()) {
    // 기존 텍스트를 단순 단락으로 래핑
    return [{ type: "paragraph", content: [{ type: "text", text: body, styles: {} }] }];
  }
  return undefined;
}

interface Props {
  page: PageData;
}

export default function BlockEditor({ page }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useCreateBlockNote({
    initialContent: parseInitialContent(page.body),
  });

  const save = useCallback(
    async (ed: BlockNoteEditor) => {
      const body = JSON.stringify(ed.document);
      await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...page, body }),
      });
    },
    [page]
  );

  const handleChange = useCallback(
    (ed: BlockNoteEditor) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => save(ed), 2500);
    },
    [save]
  );

  return (
    <BlockNoteView
      editor={editor}
      onChange={handleChange}
      theme="light"
    />
  );
}
