"use client";

import { createReactBlockSpec } from "@blocknote/react";

function parseItems(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through
  }
  return [""];
}

function CalloutBoxRenderer({
  block,
  editor,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
}) {
  const items = parseItems(block.props.items as string);

  const updateItem = (index: number, value: string) => {
    const next = items.map((item, i) => (i === index ? value : item));
    editor.updateBlock(block.id, { props: { items: JSON.stringify(next) } });
  };

  return (
    <div
      contentEditable={false}
      className="my-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
    >
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 text-[var(--fg-muted)]">•</span>
            <input
              value={item}
              disabled={!editor.isEditable}
              onChange={(e) => updateItem(i, e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 bg-transparent text-[var(--fg)] outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const CalloutBoxSpecFactory = createReactBlockSpec(
  {
    type: "calloutBox" as const,
    propSchema: {
      // string[] 을 JSON 문자열로 저장 — pricingCards의 packages와 같은 이유.
      items: { default: JSON.stringify([""]) },
    },
    content: "none" as const,
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => (
      <CalloutBoxRenderer block={block} editor={editor} />
    ),
  }
);

export const calloutBoxSpec = CalloutBoxSpecFactory();
