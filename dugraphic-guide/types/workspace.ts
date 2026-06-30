export type PageType = "page" | "database" | "document";

export interface Page {
  id: string;
  title: string;
  icon?: string;
  type: PageType;
  parentId?: string;
  children?: Page[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  icon?: string;
  pages: Page[];
}
