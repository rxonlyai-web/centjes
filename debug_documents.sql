-- Debug script to check document linking
-- Run this in Supabase SQL Editor to see what's in the database

-- 1. Check if documents exist
SELECT id, user_id, file_path, storage_path, original_filename, status, uploaded_at
FROM documents
ORDER BY uploaded_at DESC
LIMIT 10;

-- 2. Check if transaction_documents links exist  
SELECT td.*, t.omschrijving, d.original_filename
FROM transaction_documents td
LEFT JOIN transacties t ON t.id = td.transaction_id
LEFT JOIN documents d ON d.id = td.document_id
ORDER BY td.created_at DESC
LIMIT 10;

-- 3. Check recent transactions
SELECT id, datum, omschrijving, bedrag, bon_url, gebruiker_id
FROM transacties
ORDER BY datum DESC
LIMIT 10;

-- 4. Find orphaned documents (not linked to any transaction)
SELECT d.id, d.original_filename, d.uploaded_at, d.file_path, d.storage_path
FROM documents d
LEFT JOIN transaction_documents td ON td.document_id = d.id
WHERE td.id IS NULL
ORDER BY d.uploaded_at DESC
LIMIT 10;
