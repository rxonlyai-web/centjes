-- Add VAT treatment metadata columns to transacties table
ALTER TABLE IF EXISTS public.transacties
ADD COLUMN IF NOT EXISTS vat_treatment text NOT NULL DEFAULT 'domestic',
ADD COLUMN IF NOT EXISTS amount_includes_vat boolean NOT NULL DEFAULT true;

-- Optional: Validate allowed values for vat_treatment
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacties_vat_treatment_check') THEN
        ALTER TABLE public.transacties
        ADD CONSTRAINT transacties_vat_treatment_check
        CHECK (vat_treatment IN ('domestic', 'foreign_service_reverse_charge'));
    END IF;
END
$$;
