-- Check Gmail connection status
SELECT 
  gmail_address,
  is_active,
  connected_at,
  last_sync_at
FROM user_gmail_connections
WHERE gmail_address = 'rxonly.ai@gmail.com';

-- If not found or not active, check all connections
SELECT * FROM user_gmail_connections;
