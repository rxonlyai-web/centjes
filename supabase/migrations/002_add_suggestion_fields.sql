-- Add suggestion fields to documents table
alter table documents 
add column if not exists suggested_transaction jsonb,
add column if not exists suggestion_status text check (suggestion_status in ('none', 'suggested', 'accepted', 'rejected')) default 'none',
add column if not exists suggestion_confidence numeric,
add column if not exists suggestion_notes jsonb,
add column if not exists suggested_at timestamp with time zone;
