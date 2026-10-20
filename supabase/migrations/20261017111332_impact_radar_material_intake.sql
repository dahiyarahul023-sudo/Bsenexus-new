-- Source-independent material event terms. Browser clients never read or write these rules.
create table public.impact_intake_rules (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{0,63}$'),
  category text not null references public.impact_categories(id),
  label text not null check (length(label) between 1 and 100),
  terms text[] not null check (cardinality(terms) between 1 and 100),
  exclude_terms text[] not null default '{}' check (cardinality(exclude_terms) <= 100),
  priority integer not null,
  active boolean not null default true
);
alter table public.impact_intake_rules enable row level security;
revoke all on public.impact_intake_rules from public, anon, authenticated;
grant select, insert, update, delete on public.impact_intake_rules to service_role;
insert into public.impact_intake_rules(id,category,label,terms,priority) values
  ('governance_report','governance','Governance report',array['accounting irregularities','financial irregularities','fraud','fraud allegations','alleges','whistleblower','short seller report','forensic report','misstatement','bribery','investigation'],10),
  ('operational_incident','operations','Operational development',array['plant fire','factory fire','explosion','production halted','halts production','production suspended','plant shutdown','factory shutdown','cyberattack','cyber attack','data breach','product recall','licence revoked','license revoked','licence suspended','license suspended'],20),
  ('financial_liability','liability','Financial liability',array['loan default','debt default','payment default','tax demand','demand notice','credit rating downgrade'],30),
  ('business_restriction','restriction','Business restriction',array['debarment','business ban','trading suspension','operations suspended','business restriction'],40),
  ('corporate_transaction','deals','Corporate transaction',array['insolvency','bankruptcy','acquisition','merger','demerger','takeover','arbitration'],50);

-- Tiny final-session snapshots for the companies opened in Radar. No complete exchange files.
create table public.impact_price_sessions (
  symbol text not null check (symbol ~ '^[A-Z0-9&._-]{1,30}$'),
  session_date date not null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data->>'symbol' = symbol and data->>'date' = session_date::text),
  recorded_at timestamptz not null default now(),
  primary key (symbol, session_date)
);
alter table public.impact_price_sessions enable row level security;
revoke all on public.impact_price_sessions from public, anon, authenticated;
grant select, insert on public.impact_price_sessions to service_role;
