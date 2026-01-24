-- Add source column to track invoice origin
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';

-- Add index for webhook-created invoices
CREATE INDEX IF NOT EXISTS idx_invoices_source ON invoices(source);

-- Add comment for documentation
COMMENT ON COLUMN invoices.source IS 'Origin of invoice: manual, ai, or webhook';
