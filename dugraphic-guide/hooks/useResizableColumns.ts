"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const MIN_COL_WIDTH = 60;

export function useResizableColumns(
  storageKey: string,
  defaultWidths: Record<string, number>
) {
  const defaultWidthsRef = useRef(defaultWidths);

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return defaultWidths;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved && typeof saved === "object") return { ...defaultWidths, ...saved };
    } catch {
      /* ignore */
    }
    return defaultWidths;
  });

  const widthsRef = useRef(widths);
  useEffect(() => {
    widthsRef.current = widths;
  }, [widths]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      /* ignore */
    }
  }, [storageKey, widths]);

  const startResize = useCallback((colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth =
      widthsRef.current[colId] ?? defaultWidthsRef.current[colId] ?? 120;

    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + ev.clientX - startX);
      setWidths((prev) => ({ ...prev, [colId]: newWidth }));
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const getWidth = useCallback(
    (colId: string, fallback = 120) =>
      widths[colId] ?? defaultWidthsRef.current[colId] ?? fallback,
    [widths]
  );

  return { widths, startResize, getWidth };
}
