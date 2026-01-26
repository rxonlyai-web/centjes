-- Add VAT treatment and currency fields to pending_expenses
-- Migration: 20260126_add_vat_currency_to_pending_expenses

-- Add new columns for VAT treatment and currency handling
ALTER TABLE pending_expenses
  ADD COLUMN IF NOT EXISTS vendor_country VARCHAR(2),  -- ISO 2-letter code
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR',  -- EUR, USD, GBP, etc.
  ADD COLUMN IF NOT EXISTS total_amount_eur DECIMAL(10, 2),  -- Converted amount if not EUR
  ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 4),  -- Exchange rate used
  ADD COLUMN IF NOT EXISTS vat_treatment VARCHAR(50) DEFAULT 'domestic' CHECK (vat_treatment IN ('domestic', 'foreign_service_reverse_charge', 'unknown')),
  ADD COLUMN IF NOT EXISTS eu_location VARCHAR(20) CHECK (eu_location IN ('EU', 'NON_EU', 'UNKNOWN'));

-- Add comments for documentation
COMMENT ON COLUMN pending_expenses.vendor_country IS 'Supplier country code (NL, US, SG, etc.)';
COMMENT ON COLUMN pending_expenses.currency IS 'Original invoice currency';
COMMENT ON COLUMN pending_expenses.total_amount_eur IS 'Total amount converted to EUR (if not EUR)';
COMMENT ON COLUMN pending_expenses.exchange_rate IS 'Exchange rate used for EUR conversion';
COMMENT ON COLUMN pending_expenses.vat_treatment IS 'VAT treatment: domestic, foreign_service_reverse_charge, or unknown';
COMMENT ON COLUMN pending_expenses.eu_location IS 'Supplier location: EU, NON_EU, or UNKNOWN';
