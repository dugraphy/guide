"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PageSidebarItem from "./PageSidebarItem";
import type { PageData } from "@/lib/data";

interface Props {
  pages: PageData[];
  canEdit: boolean;
}

function SortablePageRow({ page, canEdit }: { page: PageData; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.slug, disabled: !canEdit });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        boxShadow: isDragging ? "0 6px 16px rgba(0,0,0,0.18)" : undefined,
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
      }}
      {...attributes}
      {...listeners}
    >
      <PageSidebarItem
        slug={page.slug}
        href={`/page/${page.slug}`}
        label={page.title}
        canEdit={canEdit}
      />
    </div>
  );
}

export default function SortablePagesList({ pages, canEdit }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(pages);

  useEffect(() => {
    setItems(pages);
  }, [pages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  if (!canEdit) {
    return (
      <>
        {pages.map((page) => (
          <PageSidebarItem
            key={page.slug}
            slug={page.slug}
            href={`/page/${page.slug}`}
            label={page.title}
            canEdit={false}
          />
        ))}
      </>
    );
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((p) => p.slug === active.id);
    const newIndex = items.findIndex((p) => p.slug === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    try {
      await fetch("/api/pages/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: reordered.map((p) => p.slug) }),
      });
    } finally {
      router.refresh();
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((p) => p.slug)} strategy={verticalListSortingStrategy}>
        {items.map((page) => (
          <SortablePageRow key={page.slug} page={page} canEdit={canEdit} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
