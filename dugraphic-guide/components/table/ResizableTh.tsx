"use client";

import React from "react";
import { TABLE } from "./tableStyles";

interface Props {
  colId: string;
  width: number;
  onResizeStart: (colId: string, e: React.MouseEvent) => void;
  className?: string;
  children: React.ReactNode;
  noHandle?: boolean;
}

export function ResizableTh({
  colId,
  width,
  onResizeStart,
  className = "",
  children,
  noHandle = false,
}: Props) {
  return (
    <th
      style={{ width, minWidth: width }}
      className={`${TABLE.th} ${className}`}
    >
      {children}
      {!noHandle && (
        <span
          onMouseDown={(e) => onResizeStart(colId, e)}
          className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize z-10 group/rh"
          aria-hidden
        >
          <span className="w-px h-4 bg-[var(--border)] group-hover/rh:bg-[var(--accent)] group-hover/rh:w-0.5 transition-all block" />
        </span>
      )}
    </th>
  );
}
