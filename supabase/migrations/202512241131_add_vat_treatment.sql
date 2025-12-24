-- Add columns to transacties table (used by dashboard actions)
ALTER TABLE IF EXISTS transacties 
ADD COLUMN IF NOT EXISTS vat_treatment text NOT NULL DEFAULT 'domestic',
ADD COLUMN IF NOT EXISTS amount_includes_vat boolean NOT NULL DEFAULT true;

-- Suggestion: Also add to transactions table if it exists, to cover user confusing naming
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
        ALTER TABLE public.transactions 
        ADD COLUMN IF NOT EXISTS vat_treatment text NOT NULL DEFAULT 'domestic',
        ADD COLUMN IF NOT EXISTS amount_includes_vat boolean NOT NULL DEFAULT true;
    END IF;
END
$$;
