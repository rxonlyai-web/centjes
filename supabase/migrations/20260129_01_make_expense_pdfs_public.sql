-- Make expense-pdfs bucket public so OCR can access files via URL
-- The bucket was created as private, but getPublicUrl() requires a public bucket
UPDATE storage.buckets
SET public = true
WHERE id = 'expense-pdfs';
