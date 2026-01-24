-- Invoice Module Database Schema
-- Creates tables for company settings, invoices, invoice items, and AI conversations

-- ============================================================================
-- 1. Company Settings Table
-- ============================================================================
CREATE TABLE company_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  company_name text NOT NULL,
  kvk_number text,
  btw_number text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text DEFAULT 'Nederland',
  email text,
  phone text,
  bank_account text,
  logo_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for company_settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own company settings" ON company_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own company settings" ON company_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company settings" ON company_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Invoices Table
-- ============================================================================
CREATE TABLE invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  invoice_number text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'sent', 'paid')) DEFAULT 'draft',
  
  -- Client information
  client_name text NOT NULL,
  client_email text,
  client_address text,
  client_kvk text,
  client_btw text,
  
  -- Invoice details
  invoice_date date NOT NULL,
  due_date date,
  payment_terms text DEFAULT 'Betaling binnen 14 dagen',
  
  -- Financial
  subtotal numeric(10, 2) NOT NULL,
  vat_rate numeric(5, 2) DEFAULT 21.00,
  vat_amount numeric(10, 2) NOT NULL,
  total_amount numeric(10, 2) NOT NULL,
  
  -- Additional
  notes text,
  pdf_url text,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(user_id, invoice_number)
);

-- RLS for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own invoices" ON invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices" ON invoices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices" ON invoices
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date DESC);

-- ============================================================================
-- 3. Invoice Items Table
-- ============================================================================
CREATE TABLE invoice_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid REFERENCES invoices ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price numeric(10, 2) NOT NULL,
  total_price numeric(10, 2) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for invoice_items (inherit from parent invoice)
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items of their own invoices" ON invoice_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items to their own invoices" ON invoice_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items of their own invoices" ON invoice_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items of their own invoices" ON invoice_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND invoices.user_id = auth.uid()
    )
  );

-- Index for performance
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ============================================================================
-- 4. Invoice Conversations Table (AI Chat History)
-- ============================================================================
CREATE TABLE invoice_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  invoice_id uuid REFERENCES invoices ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]',
  conversation_state jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for invoice_conversations
ALTER TABLE invoice_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations" ON invoice_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON invoice_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON invoice_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON invoice_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_invoice_conversations_user_id ON invoice_conversations(user_id);
CREATE INDEX idx_invoice_conversations_invoice_id ON invoice_conversations(invoice_id);

-- ============================================================================
-- 5. Helper Function: Generate Invoice Number
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_invoice_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_count integer;
  v_invoice_number text;
BEGIN
  -- Get current year
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  
  -- Count existing invoices for this user in current year
  SELECT COUNT(*) + 1 INTO v_count
  FROM invoices
  WHERE user_id = p_user_id
  AND invoice_number LIKE v_year || '-%';
  
  -- Format: YYYY-NNN (e.g., 2026-001)
  v_invoice_number := v_year || '-' || LPAD(v_count::text, 3, '0');
  
  RETURN v_invoice_number;
END;
$$;
