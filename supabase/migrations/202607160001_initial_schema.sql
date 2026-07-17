begin;

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'coordenador', 'colaborador');
create type public.work_shift as enum ('MANHÃ', 'TARDE', 'NOITE');
create type public.sector_type as enum ('Médica', 'Ortopédica', 'Cirúrgica');
create type public.indicator_kind as enum ('contagem', 'taxa', 'texto');
create type public.scale_type as enum ('barthel', 'mrc', 'melhoria_uti');
create type public.assessment_moment as enum ('entrada', 'saida');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'colaborador',
  service_id uuid references public.services(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  context text not null check (context in ('uti', 'enfermaria', 'clinica', 'ambulatorio')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.service_sectors (
  service_id uuid not null references public.services(id) on delete cascade,
  sector_id uuid not null references public.sectors(id) on delete cascade,
  primary key (service_id, sector_id)
);

create table public.collaborators (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  normalized_name text generated always as (
    lower(regexp_replace(trim(canonical_name), '\s+', ' ', 'g'))
  ) stored,
  service_id uuid not null references public.services(id),
  user_id uuid unique references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, normalized_name)
);

create table public.collaborator_aliases (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators(id) on delete cascade,
  alias text not null,
  normalized_alias text generated always as (
    lower(regexp_replace(trim(alias), '\s+', ' ', 'g'))
  ) stored unique
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  initials text not null check (char_length(initials) between 1 and 30),
  record_number text not null,
  age smallint check (age between 0 and 130),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_number)
);

comment on table public.patients is 'Dados mínimos permitidos pela LGPD: iniciais, prontuário/registro e idade; nomes completos são proibidos.';

create table public.indicators (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  context text not null default 'geral' check (context in ('geral', 'uti', 'enfermaria', 'ambulatorio')),
  kind public.indicator_kind not null,
  unit text not null default 'quantidade',
  display_order smallint not null default 0,
  active boolean not null default true,
  derived boolean not null default false,
  numerator_indicator_id uuid references public.indicators(id),
  denominator_indicator_id uuid references public.indicators(id),
  created_at timestamptz not null default now(),
  check (
    (derived = false and numerator_indicator_id is null and denominator_indicator_id is null)
    or (derived = true and numerator_indicator_id is not null and denominator_indicator_id is not null)
  )
);

create table public.production_records (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id),
  record_date date not null,
  shift public.work_shift not null,
  sector_id uuid not null references public.sectors(id),
  sector_type public.sector_type,
  collaborator_id uuid not null references public.collaborators(id),
  context text not null default 'geral' check (context in ('geral', 'uti', 'enfermaria', 'ambulatorio')),
  notes text check (char_length(notes) <= 2000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, record_date, shift, sector_id, collaborator_id, context)
);

create table public.production_values (
  record_id uuid not null references public.production_records(id) on delete cascade,
  indicator_id uuid not null references public.indicators(id),
  numeric_value numeric(12, 4),
  text_value text,
  primary key (record_id, indicator_id),
  check (num_nonnulls(numeric_value, text_value) = 1),
  check (numeric_value is null or numeric_value >= 0)
);

create table public.scale_items (
  id uuid primary key default gen_random_uuid(),
  scale_type public.scale_type not null,
  code text not null,
  name text not null,
  display_order smallint not null,
  max_points smallint not null check (max_points >= 0),
  unique (scale_type, code),
  unique (scale_type, display_order)
);

create table public.scale_item_options (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.scale_items(id) on delete cascade,
  label text not null,
  points smallint not null check (points >= 0),
  display_order smallint not null,
  unique (item_id, points),
  unique (item_id, display_order)
);

create table public.scale_assessments (
  id uuid primary key default gen_random_uuid(),
  scale_type public.scale_type not null,
  patient_id uuid not null references public.patients(id),
  collaborator_id uuid references public.collaborators(id),
  assessment_date date not null,
  moment public.assessment_moment not null,
  sector_id uuid not null references public.sectors(id),
  sector_type public.sector_type,
  attendance_number text,
  cid text check (char_length(cid) <= 120),
  event_date date,
  notes text check (char_length(notes) <= 2000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scale_scores (
  assessment_id uuid not null references public.scale_assessments(id) on delete cascade,
  item_id uuid not null references public.scale_items(id),
  option_id uuid not null references public.scale_item_options(id),
  primary key (assessment_id, item_id)
);

create table public.indicator_targets (
  id uuid primary key default gen_random_uuid(),
  indicator_id uuid not null references public.indicators(id) on delete cascade,
  sector_id uuid references public.sectors(id) on delete cascade,
  valid_from date not null,
  valid_until date,
  target_value numeric(12, 4) not null check (target_value >= 0),
  comparison text not null default 'minimo' check (comparison in ('minimo', 'maximo')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  unique nulls not distinct (indicator_id, sector_id, valid_from)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index production_records_dashboard_idx on public.production_records (record_date, service_id, sector_id);
create index production_records_collaborator_idx on public.production_records (collaborator_id, record_date);
create index production_values_indicator_idx on public.production_values (indicator_id, record_id);
create index scale_assessments_pair_idx on public.scale_assessments (scale_type, patient_id, attendance_number, assessment_date, moment);
create unique index scale_assessments_unique_event_idx on public.scale_assessments
  (scale_type, patient_id, assessment_date, moment, coalesce(attendance_number, ''));
create index audit_logs_lookup_idx on public.audit_logs (table_name, record_id, changed_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger collaborators_updated_at before update on public.collaborators
for each row execute function public.set_updated_at();
create trigger patients_updated_at before update on public.patients
for each row execute function public.set_updated_at();
create trigger production_records_updated_at before update on public.production_records
for each row execute function public.set_updated_at();
create trigger scale_assessments_updated_at before update on public.scale_assessments
for each row execute function public.set_updated_at();

create or replace function public.validate_production_value()
returns trigger language plpgsql as $$
declare
  expected_service uuid;
  actual_service uuid;
  indicator_type public.indicator_kind;
  is_derived boolean;
begin
  select service_id into actual_service from public.production_records where id = new.record_id;
  select service_id, kind, derived into expected_service, indicator_type, is_derived
    from public.indicators where id = new.indicator_id;
  if actual_service is distinct from expected_service then
    raise exception 'Indicador não pertence ao serviço do lançamento';
  end if;
  if is_derived then
    raise exception 'Indicadores derivados não podem ser digitados';
  end if;
  if indicator_type = 'texto' and new.text_value is null then
    raise exception 'Indicador textual exige text_value';
  elsif indicator_type <> 'texto' and new.numeric_value is null then
    raise exception 'Indicador numérico exige numeric_value';
  end if;
  return new;
end;
$$;

create trigger production_value_validation before insert or update on public.production_values
for each row execute function public.validate_production_value();

create or replace function public.validate_scale_score()
returns trigger language plpgsql as $$
declare
  option_item uuid;
  expected_scale public.scale_type;
  actual_scale public.scale_type;
begin
  select item_id into option_item from public.scale_item_options where id = new.option_id;
  if option_item is distinct from new.item_id then
    raise exception 'Opção não pertence ao item informado';
  end if;
  select scale_type into expected_scale from public.scale_items where id = new.item_id;
  select scale_type into actual_scale from public.scale_assessments where id = new.assessment_id;
  if expected_scale is distinct from actual_scale then
    raise exception 'Item não pertence à escala da avaliação';
  end if;
  return new;
end;
$$;

create trigger scale_score_validation before insert or update on public.scale_scores
for each row execute function public.validate_scale_score();

create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
language plpgsql as $$
begin
  insert into public.profiles (user_id, full_name, role, service_id)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    'colaborador',
    null
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;
