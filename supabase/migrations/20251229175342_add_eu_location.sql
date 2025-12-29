-- Add eu_location column to transacties table for VAT reporting
-- This enables proper Dutch VAT return rubric mapping (4a and 4b)

ALTER TABLE IF EXISTS transacties 
ADD COLUMN IF NOT EXISTS eu_location text 
CHECK (eu_location IN ('EU', 'NON_EU', 'UNKNOWN')) 
DEFAULT 'UNKNOWN';

-- Add comment for documentation
COMMENT ON COLUMN transacties.eu_location IS 'Supplier location for reverse-charge VAT: EU (rubric 4b), NON_EU (rubric 4a), or UNKNOWN (requires manual review)';

-- Update existing reverse-charge transactions to UNKNOWN (requires manual review/re-classification)
UPDATE transacties 
SET eu_location = 'UNKNOWN' 
WHERE vat_treatment = 'foreign_service_reverse_charge' 
AND (eu_location IS NULL OR eu_location = '');

-- For domestic transactions, set to NULL (not applicable)
UPDATE transacties 
SET eu_location = NULL 
WHERE vat_treatment = 'domestic';
