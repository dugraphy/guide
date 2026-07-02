"use client";

import { useEffect, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
}

let seq = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  listeners.forEach((listener) => listener(toasts));
}

// 어느 클라이언트 컴포넌트에서든 호출 가능한 전역 에러 토스트.
// (낙관적 업데이트 실패 시 롤백과 함께 사용)
export function showErrorToast(message: string) {
  const id = ++seq;
  toasts = [...toasts, { id, message }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3500);
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto bg-red-600 text-white text-sm px-4 py-2 rounded shadow-lg max-w-sm"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
