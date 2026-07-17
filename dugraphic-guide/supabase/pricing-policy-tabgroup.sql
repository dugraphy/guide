-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Replaces the "기준 단가표" section of the "가격정책" template with a tabGroup
-- block ("자체 개발형" / "웹빌더형" tabs), each holding its own description
-- paragraph + grade table (라이트/스탠다드/프로 · 대상 · 가격).
-- Safe to re-run — targets the single existing row by name.

update public.templates
set blocks = $tpl$[
  {"type":"paragraph","content":"본 견적은 프로젝트 범위 확인 후 상담을 통해 최종 산정됩니다. 아래 기준 단가는 참고용입니다."},
  {"type":"heading","props":{"level":3},"content":"기준 단가표"},
  {"type":"tabGroup","props":{"tabs":"[{\"title\":\"자체 개발형\",\"content\":[{\"type\":\"paragraph\",\"content\":\"순수 서버·도메인 연결 비용입니다. 직접 개발한 사이트를 안정적으로 운영하기 위한 서버 호스팅과 도메인 연결 비용이며, 디자인·개발 비용과는 별도로 청구됩니다.\"},{\"type\":\"table\",\"content\":{\"type\":\"tableContent\",\"rows\":[{\"cells\":[\"등급\",\"대상\",\"가격\"]},{\"cells\":[\"라이트\",\"\",\"\"]},{\"cells\":[\"스탠다드\",\"\",\"\"]},{\"cells\":[\"프로\",\"\",\"\"]}]}}]},{\"title\":\"웹빌더형\",\"content\":[{\"type\":\"paragraph\",\"content\":\"웹빌더 소프트웨어, 디자인 템플릿 이용료와 호스팅이 포함된 플랫폼 구독 비용입니다. 별도의 서버 관리 없이 웹빌더사가 제공하는 환경을 그대로 사용합니다.\"},{\"type\":\"table\",\"content\":{\"type\":\"tableContent\",\"rows\":[{\"cells\":[\"등급\",\"대상\",\"가격\"]},{\"cells\":[\"라이트\",\"\",\"\"]},{\"cells\":[\"스탠다드\",\"\",\"\"]},{\"cells\":[\"프로\",\"\",\"\"]}]}}]}]","activeTab":0}},
  {"type":"heading","props":{"level":3},"content":"도메인 단가표"},
  {"type":"domainSearch"},
  {"type":"heading","props":{"level":3},"content":"가격이 달라지는 경우"},
  {"type":"calloutBox","props":{"items":"[\"레퍼런스 있음: 기본가 × 1.0\",\"레퍼런스 없이 처음부터 컨셉 설계: 기본가에 (편집 가능한 금액)원 추가\",\"일러스트 제작: 건당 (편집 가능한 금액)원 추가\",\"플랫폼 마이그레이션: 건당 (편집 가능한 금액)원 추가\"]"}},
  {"type":"heading","props":{"level":3},"content":"계약금/잔금 기준"},
  {"type":"calloutBox","props":{"items":"[\"계약금은 시안 작업 비용이며, 계약금 입금 시 계약이 확정됩니다.\",\"결과물 제작이 완료되면 잔금 입금 시 결과물이 제공됩니다.\"]"}},
  {"type":"heading","props":{"level":3},"content":"계약금 및 취소 규정"},
  {"type":"calloutBox","props":{"items":"[\"계약금 입금 시점부터 시안 기획 및 초기 작업이 착수되며, 이는 단순 예약금이 아닌 초기 작업에 대한 대가로 간주됩니다.\",\"시안 전달 후 (편집 가능한 숫자)일 이내 별도의 이의 제기가 없을 경우, 해당 시안은 승인된 것으로 간주하며 이후 계약금은 환불되지 않습니다.\",\"시안 승인(문자/카카오톡/이메일을 통한 명시적 승인 포함) 이후 작업이 진행된 경우, 계약금은 환불되지 않습니다.\"]"}}
]$tpl$::jsonb
where name = '가격정책';
