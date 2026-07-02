export interface PageData {
  slug: string;
  icon: string;
  title: string;
  description: string;
  body: string;
  sortOrder?: number | null;
}

export const PAGES: PageData[] = [
  {
    slug: "overview",
    icon: "📋",
    title: "프로젝트 개요",
    description: "Dugraphic Guide의 목표와 방향을 정리한 문서입니다.",
    body: `이 프로젝트는 노션 스타일의 워크스페이스 앱을 만들기 위한 시작점입니다.

Next.js App Router, TypeScript, Tailwind CSS를 기반으로 구축되어 있으며
블록 에디터, 페이지 계층 구조, 데이터베이스 뷰를 단계적으로 추가할 예정입니다.`,
  },
  {
    slug: "design",
    icon: "🎨",
    title: "디자인 가이드",
    description: "색상, 타이포그래피, 컴포넌트 스타일 규칙을 정리합니다.",
    body: `## 색상 시스템

CSS 변수로 정의된 디자인 토큰을 사용합니다.

- --bg: 기본 배경 (#ffffff)
- --bg-secondary: 사이드바 배경 (#f7f7f5)
- --fg: 기본 텍스트 (#37352f)
- --fg-muted: 보조 텍스트 (#9b9a97)
- --border: 구분선 (#e9e9e7)
- --accent: 강조색 (#2eaadc)

## 폰트

시스템 UI 폰트 스택을 사용합니다. Notion과 동일한 느낌을 줍니다.`,
  },
  {
    slug: "todos",
    icon: "✅",
    title: "할 일 목록",
    description: "개발 로드맵과 남은 작업을 추적합니다.",
    body: `## 완료

- [x] Next.js 프로젝트 초기 설정
- [x] 사이드바 컴포넌트
- [x] 워크스페이스 레이아웃
- [x] 동적 페이지 라우트

## 진행 중

- [ ] 블록 에디터 (텍스트, 제목, 체크리스트)
- [ ] 페이지 계층 구조 (하위 페이지)

## 예정

- [ ] 데이터베이스 뷰 (테이블, 칸반)
- [ ] 다크 모드
- [ ] 검색 기능`,
  },
];

export function getPage(slug: string): PageData | undefined {
  return PAGES.find((p) => p.slug === slug);
}
