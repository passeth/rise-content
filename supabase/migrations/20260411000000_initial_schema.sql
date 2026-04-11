-- =============================================================================
-- EVAS PDP Maker - Initial Schema
-- Migration: 20260411000000_initial_schema
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

create or replace function public.get_user_role()
returns text
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'editor'
  );
  return new;
end;
$$;

-- =============================================================================
-- TABLES
-- =============================================================================

-- profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  gemini_api_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- role_permissions (RBAC)
create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('admin', 'editor', 'viewer')),
  resource text not null,
  action text not null check (action in ('create', 'read', 'update', 'delete', 'manage')),
  unique (role, resource, action)
);

-- brands
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  color_palette jsonb not null default '{}',
  protected_terms text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- components (Figma layout components)
create table public.components (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands on delete cascade,
  name text not null,
  category text not null check (category in ('hero', 'benefit', 'ingredient', 'review', 'cta', 'usage', 'routine')),
  figma_file_key text,
  figma_node_id text,
  version integer not null default 1,
  thumbnail_url text,
  template_data jsonb not null default '{}',
  text_slots jsonb not null default '[]',
  image_slots jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  brand_id uuid not null references public.brands on delete restrict,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed')),
  product_info jsonb not null default '{}',
  agent_context jsonb not null default '{}',
  canvas_state jsonb not null default '{"sections":[]}',
  blueprint jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- generated_images
create table public.generated_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  section_id text not null,
  prompt text not null,
  prompt_options jsonb not null default '{}',
  image_url text not null,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

-- translations
create table public.translations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  language text not null check (language in ('en', 'zh', 'ja', 'vi', 'ru')),
  content jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (project_id, language)
);

-- chat_histories
create table public.chat_histories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger components_updated_at
  before update on public.components
  for each row execute function public.update_updated_at();

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at();

-- =============================================================================
-- INDEXES
-- =============================================================================

create index idx_projects_user_id on public.projects (user_id);
create index idx_projects_brand_id on public.projects (brand_id);
create index idx_projects_status on public.projects (status);

create index idx_generated_images_project_section on public.generated_images (project_id, section_id);
create index idx_generated_images_project_selected on public.generated_images (project_id, is_selected);

create index idx_translations_project_id on public.translations (project_id);

create index idx_chat_histories_project_created on public.chat_histories (project_id, created_at);

create index idx_components_brand_category on public.components (brand_id, category);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.brands enable row level security;
alter table public.components enable row level security;
alter table public.projects enable row level security;
alter table public.generated_images enable row level security;
alter table public.translations enable row level security;
alter table public.chat_histories enable row level security;

-- profiles policies
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or get_user_role() = 'admin');

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or get_user_role() = 'admin')
  with check (id = auth.uid() or get_user_role() = 'admin');

-- Insert handled by trigger only; no direct insert policy for authenticated users

-- role_permissions policies
create policy "role_permissions_select"
  on public.role_permissions for select
  to authenticated
  using (true);

create policy "role_permissions_insert"
  on public.role_permissions for insert
  to authenticated
  with check (get_user_role() = 'admin');

create policy "role_permissions_update"
  on public.role_permissions for update
  to authenticated
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "role_permissions_delete"
  on public.role_permissions for delete
  to authenticated
  using (get_user_role() = 'admin');

-- brands policies
create policy "brands_select"
  on public.brands for select
  to authenticated
  using (true);

create policy "brands_insert"
  on public.brands for insert
  to authenticated
  with check (get_user_role() = 'admin');

create policy "brands_update"
  on public.brands for update
  to authenticated
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "brands_delete"
  on public.brands for delete
  to authenticated
  using (get_user_role() = 'admin');

-- components policies
create policy "components_select"
  on public.components for select
  to authenticated
  using (true);

create policy "components_insert"
  on public.components for insert
  to authenticated
  with check (get_user_role() = 'admin');

create policy "components_update"
  on public.components for update
  to authenticated
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "components_delete"
  on public.components for delete
  to authenticated
  using (get_user_role() = 'admin');

-- projects policies
create policy "projects_select"
  on public.projects for select
  to authenticated
  using (user_id = auth.uid() or get_user_role() = 'admin');

create policy "projects_insert"
  on public.projects for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "projects_update"
  on public.projects for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "projects_delete"
  on public.projects for delete
  to authenticated
  using (user_id = auth.uid());

-- generated_images policies
create policy "generated_images_select"
  on public.generated_images for select
  to authenticated
  using (
    get_user_role() = 'admin'
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "generated_images_insert"
  on public.generated_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "generated_images_update"
  on public.generated_images for update
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "generated_images_delete"
  on public.generated_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- translations policies
create policy "translations_select"
  on public.translations for select
  to authenticated
  using (
    get_user_role() = 'admin'
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "translations_insert"
  on public.translations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "translations_update"
  on public.translations for update
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "translations_delete"
  on public.translations for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- chat_histories policies
create policy "chat_histories_select"
  on public.chat_histories for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "chat_histories_insert"
  on public.chat_histories for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "chat_histories_update"
  on public.chat_histories for update
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "chat_histories_delete"
  on public.chat_histories for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- =============================================================================
-- SEED DATA: role_permissions
-- =============================================================================

-- admin: manage all resources
insert into public.role_permissions (role, resource, action) values
  ('admin', 'projects',     'manage'),
  ('admin', 'brands',       'manage'),
  ('admin', 'components',   'manage'),
  ('admin', 'users',        'manage'),
  ('admin', 'images',       'manage'),
  ('admin', 'translations', 'manage');

-- editor: create/read/update projects; read brands/components; create/read/update images/translations
insert into public.role_permissions (role, resource, action) values
  ('editor', 'projects',     'create'),
  ('editor', 'projects',     'read'),
  ('editor', 'projects',     'update'),
  ('editor', 'brands',       'read'),
  ('editor', 'components',   'read'),
  ('editor', 'images',       'create'),
  ('editor', 'images',       'read'),
  ('editor', 'images',       'update'),
  ('editor', 'translations', 'create'),
  ('editor', 'translations', 'read'),
  ('editor', 'translations', 'update');

-- viewer: read projects, brands, components, images, translations
insert into public.role_permissions (role, resource, action) values
  ('viewer', 'projects',     'read'),
  ('viewer', 'brands',       'read'),
  ('viewer', 'components',   'read'),
  ('viewer', 'images',       'read'),
  ('viewer', 'translations', 'read');

-- =============================================================================
-- SEED DATA: brands
-- =============================================================================

insert into public.brands (name, slug, color_palette, protected_terms) values
  (
    'CERACLINIC',
    'ceraclinic',
    '{"primary": "#1A3A5C", "secondary": "#4A8FBF", "accent": "#E8F4FC", "neutral": "#F5F5F5", "text": "#1A1A1A"}',
    ARRAY['CERACLINIC', 'CeraClinic', 'Derma-Relief', 'DERMAID']
  ),
  (
    'FRAIJOUR',
    'fraijour',
    '{"primary": "#2D4A3E", "secondary": "#7BAF8E", "accent": "#F0F7F4", "neutral": "#F8F8F8", "text": "#1A1A1A"}',
    ARRAY['FRAIJOUR', 'Fraijour', 'Pro-Moisture', 'Original Cheese']
  ),
  (
    'BAERE',
    'baere',
    '{"primary": "#3B2A4A", "secondary": "#9B7EC8", "accent": "#F5F0FF", "neutral": "#FAFAFA", "text": "#1A1A1A"}',
    ARRAY['BAERE', 'Baere', 'Barrier Expert']
  ),
  (
    'ORYZA',
    'oryza',
    '{"primary": "#5C4A1A", "secondary": "#BF9F4A", "accent": "#FDF8EC", "neutral": "#F8F8F6", "text": "#1A1A1A"}',
    ARRAY['ORYZA', 'Oryza', 'Rice Water', 'ORYZA SATIVA']
  );

-- =============================================================================
-- STORAGE BUCKETS
-- (Apply via Supabase dashboard, CLI, or uncomment if storage schema is available)
-- =============================================================================

-- insert into storage.buckets (id, name, public) values ('product-images',   'product-images',   true);
-- insert into storage.buckets (id, name, public) values ('generated-images', 'generated-images', true);
-- insert into storage.buckets (id, name, public) values ('reference-images', 'reference-images', false);
