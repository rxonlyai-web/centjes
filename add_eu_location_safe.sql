-- Add eu_location column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transacties' 
        AND column_name = 'eu_location'
    ) THEN
        ALTER TABLE transacties 
        ADD COLUMN eu_location text 
        CHECK (eu_location IN ('EU', 'NON_EU', 'UNKNOWN'));
        
        COMMENT ON COLUMN transacties.eu_location IS 'Supplier location for reverse-charge VAT: EU (rubric 4b), NON_EU (rubric 4a), or UNKNOWN (requires manual review)';
        
        -- Update existing reverse-charge transactions to UNKNOWN
        UPDATE transacties 
        SET eu_location = 'UNKNOWN' 
        WHERE vat_treatment = 'foreign_service_reverse_charge' 
        AND (eu_location IS NULL OR eu_location = '');
        
        -- For domestic transactions, set to NULL
        UPDATE transacties 
        SET eu_location = NULL 
        WHERE vat_treatment = 'domestic';
    END IF;
END $$;
