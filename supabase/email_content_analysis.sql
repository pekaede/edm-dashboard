-- ============================================================================
-- email_content_analysis：邮件“内容 AI 分析”结果表（追加式、版本化）
-- ============================================================================
-- 只出 SQL，不由应用执行。请在 Supabase SQL Editor / 迁移中执行。
--
-- 前置条件（父代理另行执行，不在本文件内）：
--   1. emails 表已新增 subject / preheader / banner_url 三列（均可空）。
--   2. 【FK 前提】emails 表的真实主键是 4 元组
--      (market, brand, sent_date, day_seq)（约束名 emails_pkey），
--      且 emails 上没有任何 UNIQUE 约束。下面的 FK 引用该真实 4 元组主键。
--      严禁引用含 source_index 的 5 元组——5 元组在 emails 上没有唯一
--      约束，引用它建 FK 会报 ERROR 42830（上一版 DDL 因此全没生效）。
-- 执行顺序：先完成前提 1，再执行本文件（本文件只建分析表/视图/策略/授权）。
--
-- 语义：
--   - 每行 = 某封邮件 × 某类分析（subject / banner）的一次尝试结果。
--     追加式写入，绝不 UPDATE 覆盖旧行；失败重跑不覆盖上次可用结果。
--   - UNIQUE (market, brand, sent_date, day_seq, analysis_type, input_hash)
--     保证同一输入只保留一个“有效”记录：重跑成功前若已有同 input_hash
--     的 failed / skipped 行，由离线 pipeline 用 upsert 替换该行；
--     pipeline 永远不重跑 input_hash 未变的 success 行，因此 success 行
--     不会被覆盖（见 scripts/analyze-email-content.mjs）。
--   - pending / processing 预留给未来异步 worker；当前离线 pipeline
--     只写终端状态 success / failed / skipped。
--   - 前端只读视图 email_content_analysis_current（每（邮件，类型）最新一行）。
--
-- 权限：
--   - anon / authenticated 仅 SELECT（表 + 视图）。
--   - 写操作只走 service_role（离线任务环境变量，绝不进 VITE_*）。
--   - 视图用 security_invoker = true，使视图查询同样受基表 RLS 约束。
-- ============================================================================

create table if not exists public.email_content_analysis (
  id bigint generated always as identity primary key,

  -- 邮件定位键：引用 emails 表的真实 4 元组主键（见文件头 FK 前提）。
  market text not null,
  brand text not null,
  sent_date date not null,
  day_seq int not null,

  analysis_type text not null
    check (analysis_type in ('subject', 'banner')),
  status text not null
    check (status in ('pending', 'processing', 'success', 'failed', 'skipped')),

  -- 仅 success 时有值。subject → SubjectAnalysis，banner → BannerAnalysis。
  -- 字段间约束（cta_presence = false ⇒ cta_position 必须为 null）由写库前
  -- 与读取边界的校验函数强制，不在本层用 CHECK 表达（jsonb 形状校验
  -- 在应用层，见 src/email-content-analysis.ts 与 pipeline）。
  result jsonb null,

  -- SHA-256，覆盖实际输入：标题/副标题快照、传给 vision 的标题/品牌等
  -- 上下文、banner 图片字节哈希，以及 prompt / rules / schema / model 版本。
  -- 输入不变 ⇒ 哈希不变 ⇒ pipeline 跳过，不重复调用模型。
  input_hash text not null,

  model_version text not null,
  prompt_version text not null,
  rules_version text not null,
  schema_version text not null,
  batch_id text not null,

  -- banner 行：banner_object_key, banner_source_url, banner_sha256,
  --   banner_width, banner_height, collected_at。
  -- subject 行：subject / preheader 快照。
  input_meta jsonb not null default '{}'::jsonb,

  error_code text null,
  attempted_at timestamptz not null,
  succeeded_at timestamptz null,
  created_at timestamptz not null default now(),

  constraint email_content_analysis_fk_email
    foreign key (market, brand, sent_date, day_seq)
    references public.emails (market, brand, sent_date, day_seq)
    on delete cascade,

  constraint email_content_analysis_unique_input
    unique (market, brand, sent_date, day_seq, analysis_type, input_hash),

  constraint email_content_analysis_result_only_on_success
    check ((status = 'success' and result is not null)
        or (status <> 'success' and result is null)),
  constraint email_content_analysis_succeeded_at_only_on_success
    check ((status = 'success' and succeeded_at is not null)
        or (status <> 'success' and succeeded_at is null)),
  constraint email_content_analysis_error_only_on_failed
    check ((status = 'failed' and error_code is not null)
        or (status <> 'failed' and error_code is null))
);

comment on table public.email_content_analysis is
  '邮件内容 AI 分析结果：追加式、版本化；每行 = 一封邮件 × 一类分析的一次尝试。';
comment on column public.email_content_analysis.input_hash is
  'SHA-256，覆盖实际输入（含传给 vision 的标题/品牌上下文与各版本）；输入不变则跳过。';
comment on column public.email_content_analysis.result is
  '仅 success 时有值；subject → SubjectAnalysis，banner → BannerAnalysis。';

create index if not exists email_content_analysis_lookup_idx
  on public.email_content_analysis
    (market, brand, sent_date, day_seq, analysis_type, created_at desc);

create index if not exists email_content_analysis_status_idx
  on public.email_content_analysis (status, analysis_type);

-- ----------------------------------------------------------------------------
-- 视图：每（邮件，类型）一行；成功优先（取最新成功尝试），无成功时取最新尝试。
-- 前端只读此视图。
-- ----------------------------------------------------------------------------
create or replace view public.email_content_analysis_current
with (security_invoker = true) as
select distinct on (market, brand, sent_date, day_seq, analysis_type)
  market,
  brand,
  sent_date,
  day_seq,
  analysis_type,
  status,
  result,
  -- analyzed_at = 成功时间；未成功时为 null，前端据此区分“已分析”与“未分析”。
  succeeded_at as analyzed_at
from public.email_content_analysis
order by
  market, brand, sent_date, day_seq, analysis_type,
  (status = 'success') desc, attempted_at desc, id desc;

comment on view public.email_content_analysis_current is
  '每（邮件，类型）最新一行分析结果；前端只读此视图，不直接读基表。';

-- ----------------------------------------------------------------------------
-- RLS：anon / authenticated 仅 SELECT；写操作只走 service_role
-- （service_role 绕过 RLS，无需再配写策略；不要给 anon 写权限）。
-- ----------------------------------------------------------------------------
alter table public.email_content_analysis enable row level security;

drop policy if exists email_content_analysis_read_only
  on public.email_content_analysis;

create policy email_content_analysis_read_only
  on public.email_content_analysis
  for select
  to anon, authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- Grants：公开读 + service_role 写。视图同样只授 SELECT。
-- ----------------------------------------------------------------------------
grant select on public.email_content_analysis to anon, authenticated;
grant all on public.email_content_analysis to service_role;
grant select on public.email_content_analysis_current to anon, authenticated;
