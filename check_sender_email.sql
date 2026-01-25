-- Check sender_email format in pending_expenses
SELECT 
  id,
  sender_email,
  vendor_name,
  subject,
  ocr_status
FROM pending_expenses
ORDER BY created_at DESC
LIMIT 5;

-- If sender_email is showing as object, we need to fix the webhook
-- The webhook should store sender_email as TEXT, not JSONB
