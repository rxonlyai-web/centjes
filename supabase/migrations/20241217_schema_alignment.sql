-- Migration: Align schema for Transactions and Documents
-- 1. Update transacties (and transactions)
DO $$
BEGIN
    -- Update 'transacties'
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transacties') THEN
        ALTER TABLE public.transacties 
        ADD COLUMN IF NOT EXISTS vat_treatment text NOT NULL DEFAULT 'domestic',
        ADD COLUMN IF NOT EXISTS amount_includes_vat boolean NOT NULL DEFAULT true;

        -- Add check constraint if not exists (safe way)
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacties_vat_treatment_check') THEN
            ALTER TABLE public.transacties 
            ADD CONSTRAINT transacties_vat_treatment_check 
            CHECK (vat_treatment IN ('domestic', 'foreign_service_reverse_charge'));
        END IF;
    END IF;

    -- Update 'transactions' (if exists, just in case)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
        ALTER TABLE public.transactions 
        ADD COLUMN IF NOT EXISTS vat_treatment text NOT NULL DEFAULT 'domestic',
        ADD COLUMN IF NOT EXISTS amount_includes_vat boolean NOT NULL DEFAULT true;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_vat_treatment_check') THEN
            ALTER TABLE public.transactions 
            ADD CONSTRAINT transactions_vat_treatment_check 
            CHECK (vat_treatment IN ('domestic', 'foreign_service_reverse_charge'));
        END IF;
    END IF;
END
$$;

-- 2. Update documents table
ALTER TABLE IF EXISTS public.documents
ADD COLUMN IF NOT EXISTS extracted_json jsonb,
ADD COLUMN IF NOT EXISTS warnings text[],
ADD COLUMN IF NOT EXISTS suggestion_status text,
ADD COLUMN IF NOT EXISTS suggested_transaction jsonb,
ADD COLUMN IF NOT EXISTS suggested_at timestamptz,
ADD COLUMN IF NOT EXISTS suggestion_confidence double precision;
