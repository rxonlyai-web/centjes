-- Create a table for public profiles
create table profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,

  constraint username_length check (char_length(username) >= 3)
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Transacties Table
create table transacties (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  gebruiker_id uuid references auth.users not null,
  datum timestamp with time zone not null,
  omschrijving text not null,
  bedrag numeric not null,
  type_transactie text check (type_transactie in ('INKOMSTEN', 'UITGAVEN')) not null,
  btw_tarief numeric,
  categorie text check (categorie in ('Inkoop', 'Sales', 'Reiskosten', 'Kantoor', 'Overig')),
  vat_treatment text default 'domestic' check (vat_treatment in ('domestic', 'foreign_service_reverse_charge')),
  bon_url text
);

alter table transacties enable row level security;

create policy "Users can view their own transactions" on transacties
  for select using (auth.uid() = gebruiker_id);

create policy "Users can insert their own transactions" on transacties
  for insert with check (auth.uid() = gebruiker_id);

create policy "Users can update their own transactions" on transacties
  for update using (auth.uid() = gebruiker_id);

create policy "Users can delete their own transactions" on transacties
  for delete using (auth.uid() = gebruiker_id);

-- Documents Table
create table documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  file_path text not null,
  original_filename text not null,
  mime_type text not null,
  uploaded_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text check (status in ('uploaded', 'extracted', 'failed')) default 'uploaded',
  extracted_json jsonb,
  extraction_error text
);

alter table documents enable row level security;

create policy "Users can view their own documents" on documents
  for select using (auth.uid() = user_id);

create policy "Users can insert their own documents" on documents
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own documents" on documents
  for update using (auth.uid() = user_id);

create policy "Users can delete their own documents" on documents
  for delete using (auth.uid() = user_id);
