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
    return [{ type: "paragraph", content: [{ type: "text", text: body, styles: {} }] }];
  }
  return undefined;
}

interface Props {
  page: PageData;
  onBodyChange: (body: string) => void;
}

export default function BlockEditor({ page, onBodyChange }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useCreateBlockNote({
    initialContent: parseInitialContent(page.body),
  });

  const handleChange = useCallback(
    (ed: BlockNoteEditor) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // 300ms로 직렬화 빈도를 줄인 뒤 부모에 전달 (실제 GitHub 저장 타이머는 부모가 관리)
      timerRef.current = setTimeout(() => {
        onBodyChange(JSON.stringify(ed.document));
      }, 300);
    },
    [onBodyChange]
  );

  return <BlockNoteView editor={editor} onChange={handleChange} theme="light" />;
}
