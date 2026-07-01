"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useIsDesktop } from "./useIsDesktop";

const MIN_COL_WIDTH = 60;
const ACTION_COL_WIDTH = 40; // fixed delete-button column width

export function useResizableColumns(
  storageKey: string,
  defaultWidths: Record<string, number>
) {
  const defaultWidthsRef = useRef(defaultWidths);
  const colIdsRef = useRef(Object.keys(defaultWidths));

  // Always start with defaults — SSR and first client render are identical.
  const [widths, setWidths] = useState<Record<string, number>>(defaultWidths);
  const isMounted = useRef(false);
  const widthsRef = useRef(widths);

  useEffect(() => {
    widthsRef.current = widths;
  }, [widths]);

  // Load stored widths from localStorage after mount (client-only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved && typeof saved === "object") {
        setWidths((prev) => ({ ...prev, ...saved }));
      }
    } catch { /* ignore */ }
    isMounted.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist to localStorage on every change (skip the initial mount).
  useEffect(() => {
    if (!isMounted.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch { /* ignore */ }
  }, [storageKey, widths]);

  // ── Container width measurement ───────────────────────────────────────────
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((el: HTMLDivElement | null) => setContainerEl(el), []);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerEl) return;
    // Snapshot current width immediately, then track changes.
    setContainerWidth(containerEl.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [containerEl]);

  const isDesktop = useIsDesktop();

  // ── Scale calculation ─────────────────────────────────────────────────────
  // Raw sum of all resizable column widths (not including the action column).
  const rawSum = useMemo(
    () =>
      colIdsRef.current.reduce(
        (s, id) => s + (widths[id] ?? defaultWidthsRef.current[id] ?? 120),
        0
      ),
    [widths]
  );

  const { scaledWidths, allowScroll } = useMemo(() => {
    const minSum = colIdsRef.current.length * MIN_COL_WIDTH;

    // Mobile: always use raw widths and let the wrapper scroll.
    if (!isDesktop) {
      return { scaledWidths: widths, allowScroll: true };
    }

    // Desktop — container not yet measured: render with defaults, no scroll.
    if (containerWidth === 0) {
      return { scaledWidths: widths, allowScroll: false };
    }

    const available = containerWidth - ACTION_COL_WIDTH;

    // If even minimum widths exceed the available space, allow scroll.
    if (available < minSum) {
      return { scaledWidths: widths, allowScroll: true };
    }

    // Scale every column proportionally so they fill the container exactly.
    const scale = available / rawSum;
    const result: Record<string, number> = {};
    colIdsRef.current.forEach((id) => {
      result[id] = Math.max(
        MIN_COL_WIDTH,
        Math.round((widths[id] ?? defaultWidthsRef.current[id] ?? 120) * scale)
      );
    });
    return { scaledWidths: result, allowScroll: false };
  }, [isDesktop, containerWidth, widths, rawSum]);

  // ── Drag-resize handler ───────────────────────────────────────────────────
  const startResize = useCallback((colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widthsRef.current[colId] ?? defaultWidthsRef.current[colId] ?? 120;

    const onMove = (ev: MouseEvent) => {
      setWidths((prev) => ({
        ...prev,
        [colId]: Math.max(MIN_COL_WIDTH, startWidth + ev.clientX - startX),
      }));
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
      scaledWidths[colId] ?? defaultWidthsRef.current[colId] ?? fallback,
    [scaledWidths]
  );

  return {
    containerRef,   // attach to the TABLE.wrapper div
    widths,         // raw (stored) widths — rarely needed in views
    startResize,
    getWidth,       // returns scaled width on desktop, raw on mobile
    totalWidth: rawSum + ACTION_COL_WIDTH, // raw total for mobile minWidth
    allowScroll,    // true → set minWidth on table so overflow-x triggers
  };
}
