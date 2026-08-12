-- NEXORA AI — esquema inicial para Supabase/PostgreSQL
create table if not exists profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text,
 avatar_url text,
 role text not null default 'student' check (role in ('student','instructor','admin')),
 plan text not null default 'free' check (plan in ('free','pro','premium')),
 xp integer not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists categories (
 id bigserial primary key,
 name text not null unique,
 slug text not null unique
);
create table if not exists courses (
 id bigserial primary key,
 title text not null,
 slug text not null unique,
 description text,
 category_id bigint references categories(id),
 level text,
 price numeric(10,2) not null default 0,
 cover_url text,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists modules (
 id bigserial primary key,
 course_id bigint not null references courses(id) on delete cascade,
 title text not null,
 position integer not null
);
create table if not exists lessons (
 id bigserial primary key,
 module_id bigint not null references modules(id) on delete cascade,
 title text not null,
 content text,
 video_url text,
 duration_seconds integer default 0,
 position integer not null
);
create table if not exists enrollments (
 id bigserial primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id bigint not null references courses(id) on delete cascade,
 progress numeric(5,2) not null default 0,
 enrolled_at timestamptz not null default now(),
 unique(user_id,course_id)
);
create table if not exists lesson_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_id bigint not null references lessons(id) on delete cascade,
 completed_at timestamptz not null default now(),
 primary key(user_id,lesson_id)
);
create table if not exists certificates (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id bigint not null references courses(id) on delete cascade,
 code text not null unique,
 issued_at timestamptz not null default now()
);
create table if not exists ai_conversations (
 id bigserial primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id bigint references courses(id) on delete set null,
 lesson_id bigint references lessons(id) on delete set null,
 messages jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists subscriptions (
 id bigserial primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 plan text not null,
 status text not null,
 external_id text,
 created_at timestamptz not null default now()
);
-- Ative RLS e crie políticas antes de produção.

