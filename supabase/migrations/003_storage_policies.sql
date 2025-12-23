-- Create 'documents' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Enable RLS on storage.objects (usually enabled by default, but good to ensure)
alter table storage.objects enable row level security;

-- Policy: Users can upload their own documents
create policy "Users can upload their own documents"
on storage.objects for insert
with check (
  bucket_id = 'documents' and
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- Policy: Users can view their own documents
create policy "Users can view their own documents"
on storage.objects for select
using (
  bucket_id = 'documents' and
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- Policy: Users can update their own documents
create policy "Users can update their own documents"
on storage.objects for update
using (
  bucket_id = 'documents' and
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- Policy: Users can delete their own documents
create policy "Users can delete their own documents"
on storage.objects for delete
using (
  bucket_id = 'documents' and
  auth.uid() = (storage.foldername(name))[1]::uuid
);
