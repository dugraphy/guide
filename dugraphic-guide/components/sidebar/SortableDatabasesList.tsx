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
import SidebarItem from "./SidebarItem";
import type { DatabaseDef } from "@/lib/databases";

interface Props {
  databases: DatabaseDef[];
  canEdit: boolean;
}

function SortableDatabaseRow({ db, canEdit }: { db: DatabaseDef; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: db.slug, disabled: !canEdit });

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
      <SidebarItem href={`/db/${db.slug}`} label={db.name} />
    </div>
  );
}

export default function SortableDatabasesList({ databases, canEdit }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(databases);

  useEffect(() => {
    setItems(databases);
  }, [databases]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  if (!canEdit) {
    return (
      <>
        {databases.map((db) => (
          <SidebarItem key={db.slug} href={`/db/${db.slug}`} label={db.name} />
        ))}
      </>
    );
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((d) => d.slug === active.id);
    const newIndex = items.findIndex((d) => d.slug === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    try {
      await fetch("/api/databases/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: reordered.map((d) => d.slug) }),
      });
    } finally {
      router.refresh();
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((d) => d.slug)} strategy={verticalListSortingStrategy}>
        {items.map((db) => (
          <SortableDatabaseRow key={db.slug} db={db} canEdit={canEdit} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
