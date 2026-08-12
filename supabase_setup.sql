-- 백년밥상 품절 트래커 — Supabase 준비 (한 번만 실행)
-- Supabase 대시보드 → SQL Editor → 아래 전체 붙여넣고 Run

create table if not exists public.bb_tracker_kv (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- 이 테이블은 Vercel 서버리스 함수가 service_role 키로만 접근한다.
-- RLS를 켜두면 anon/authenticated 키로는 아무것도 못 읽는다(= 외부 노출 차단).
-- service_role 키는 RLS를 우회하므로 서버 함수는 정상 동작한다.
alter table public.bb_tracker_kv enable row level security;

-- 정책을 하나도 만들지 않는다 = anon 키로는 조회·수정 불가.
-- (혹시 예전에 만들어 둔 정책이 있다면 아래로 정리)
-- drop policy if exists "anon read" on public.bb_tracker_kv;

comment on table public.bb_tracker_kv is '품절·재입고 트래커 상태 저장 (key: bb:tracker:state, bb:tracker:calendar)';

-- 확인용
-- select key, jsonb_array_length(value->'items') as items, updated_at from public.bb_tracker_kv;
