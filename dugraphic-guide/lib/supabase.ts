import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

// Supabase pages 테이블 로우 타입
export interface PageRow {
  slug: string;
  title: string;
  body: {
    icon?: string;
    description?: string;
    blocks?: unknown[];
  };
  sort_order: number | null;
}
