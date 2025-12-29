-- Check if eu_location column exists in transacties table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transacties'
ORDER BY ordinal_position;
