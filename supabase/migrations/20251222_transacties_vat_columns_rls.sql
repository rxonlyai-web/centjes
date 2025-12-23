-- Migration: Add VAT columns and RLS to transacties table
-- Date: 2025-12-22
-- Idempotent: Safe to run multiple times

-- 1. Add VAT-related columns if they don't exist
DO $$
BEGIN
    -- Add vat_treatment column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transacties' 
        AND column_name = 'vat_treatment'
    ) THEN
        ALTER TABLE public.transacties 
        ADD COLUMN vat_treatment text NOT NULL DEFAULT 'domestic';
    END IF;

    -- Add amount_includes_vat column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transacties' 
        AND column_name = 'amount_includes_vat'
    ) THEN
        ALTER TABLE public.transacties 
        ADD COLUMN amount_includes_vat boolean NOT NULL DEFAULT true;
    END IF;
END
$$;

-- 2. Add CHECK constraint for vat_treatment (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'transacties_vat_treatment_check'
    ) THEN
        ALTER TABLE public.transacties 
        ADD CONSTRAINT transacties_vat_treatment_check 
        CHECK (vat_treatment IN ('domestic', 'foreign_service_reverse_charge', 'unknown'));
    END IF;
END
$$;

-- 3. Enable Row Level Security
ALTER TABLE public.transacties ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for authenticated users (if not exists)

-- Policy: Users can view their own transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'transacties' 
        AND policyname = 'Users can view own transactions'
    ) THEN
        CREATE POLICY "Users can view own transactions"
        ON public.transacties
        FOR SELECT
        TO authenticated
        USING (gebruiker_id = auth.uid());
    END IF;
END
$$;

-- Policy: Users can insert their own transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'transacties' 
        AND policyname = 'Users can insert own transactions'
    ) THEN
        CREATE POLICY "Users can insert own transactions"
        ON public.transacties
        FOR INSERT
        TO authenticated
        WITH CHECK (gebruiker_id = auth.uid());
    END IF;
END
$$;

-- Policy: Users can update their own transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'transacties' 
        AND policyname = 'Users can update own transactions'
    ) THEN
        CREATE POLICY "Users can update own transactions"
        ON public.transacties
        FOR UPDATE
        TO authenticated
        USING (gebruiker_id = auth.uid())
        WITH CHECK (gebruiker_id = auth.uid());
    END IF;
END
$$;

-- Policy: Users can delete their own transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'transacties' 
        AND policyname = 'Users can delete own transactions'
    ) THEN
        CREATE POLICY "Users can delete own transactions"
        ON public.transacties
        FOR DELETE
        TO authenticated
        USING (gebruiker_id = auth.uid());
    END IF;
END
$$;
