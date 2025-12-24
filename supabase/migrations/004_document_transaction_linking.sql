-- 004_document_transaction_linking.sql
-- Add proper document-transaction linking with join table and storage metadata

-- Step 1: Add missing storage metadata columns to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS storage_bucket text NOT NULL DEFAULT 'documents',
ADD COLUMN IF NOT EXISTS storage_path text,
ADD COLUMN IF NOT EXISTS size_bytes bigint;

-- Migrate existing file_path to storage_path
UPDATE documents 
SET storage_path = file_path 
WHERE storage_path IS NULL;

-- Add unique constraint on storage_path
ALTER TABLE documents 
ADD CONSTRAINT documents_storage_path_unique UNIQUE (storage_path);

-- Add index for user queries
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

-- Add warnings column if not exists (for extraction errors)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS warnings jsonb;

-- Step 2: Create join table for many-to-many relationship
CREATE TABLE IF NOT EXISTS transaction_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES transacties(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT transaction_documents_unique UNIQUE(transaction_id, document_id)
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_transaction_documents_transaction_id 
ON transaction_documents(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_documents_document_id 
ON transaction_documents(document_id);

-- Step 3: Enable RLS on join table
ALTER TABLE transaction_documents ENABLE ROW LEVEL SECURITY;

-- Users can view links for their own transactions
CREATE POLICY "Users can view their own transaction-document links"
ON transaction_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM transacties t
    WHERE t.id = transaction_documents.transaction_id
    AND t.gebruiker_id = auth.uid()
  )
);

-- Users can create links for their own transactions
CREATE POLICY "Users can insert their own transaction-document links"
ON transaction_documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM transacties t
    WHERE t.id = transaction_documents.transaction_id
    AND t.gebruiker_id = auth.uid()
  )
);

-- Users can delete links for their own transactions
CREATE POLICY "Users can delete their own transaction-document links"
ON transaction_documents FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM transacties t
    WHERE t.id = transaction_documents.transaction_id
    AND t.gebruiker_id = auth.uid()
  )
);

-- Step 4: Migrate existing data from bon_url to join table
-- Link transactions that have bon_url to their corresponding documents
INSERT INTO transaction_documents (transaction_id, document_id)
SELECT DISTINCT t.id, d.id
FROM transacties t
JOIN documents d ON (d.file_path = t.bon_url OR d.storage_path = t.bon_url)
WHERE t.bon_url IS NOT NULL
  AND t.bon_url != ''
ON CONFLICT (transaction_id, document_id) DO NOTHING;

-- Note: We keep bon_url column for backward compatibility
-- It can be deprecated in a future migration after verification
