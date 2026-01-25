-- Pending Expenses Table for Automated Expense Processing
-- Stores incoming invoices (expenses) that need review and approval

CREATE TABLE IF NOT EXISTS pending_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email metadata
  sender_email VARCHAR(255) NOT NULL,
  subject TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- PDF storage
  pdf_url TEXT NOT NULL,
  pdf_filename VARCHAR(255),
  pdf_size_bytes INTEGER,
  
  -- OCR extracted data (nullable until OCR runs)
  ocr_status VARCHAR(20) DEFAULT 'pending',
  ocr_completed_at TIMESTAMP WITH TIME ZONE,
  ocr_error TEXT,
  
  vendor_name VARCHAR(255),
  invoice_number VARCHAR(100),
  invoice_date DATE,
  due_date DATE,
  
  subtotal DECIMAL(10, 2),
  vat_rate DECIMAL(5, 2),
  vat_amount DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  
  description TEXT,
  category VARCHAR(100),
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Linked transaction (after approval)
  transaction_id UUID REFERENCES transacties(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_expenses_user ON pending_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_expenses_status ON pending_expenses(status);
CREATE INDEX IF NOT EXISTS idx_pending_expenses_created ON pending_expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_expenses_user_status ON pending_expenses(user_id, status);

-- RLS Policies
ALTER TABLE pending_expenses ENABLE ROW LEVEL SECURITY;

-- Users can view own pending expenses
CREATE POLICY "Users can view own pending expenses"
  ON pending_expenses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert own pending expenses (for webhook)
CREATE POLICY "Users can insert own pending expenses"
  ON pending_expenses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update own pending expenses
CREATE POLICY "Users can update own pending expenses"
  ON pending_expenses
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete own pending expenses
CREATE POLICY "Users can delete own pending expenses"
  ON pending_expenses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage bucket for expense PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-pdfs', 'expense-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can upload own expense PDFs
CREATE POLICY "Users can upload own expense PDFs"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'expense-pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: Users can view own expense PDFs
CREATE POLICY "Users can view own expense PDFs"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'expense-pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: Users can delete own expense PDFs
CREATE POLICY "Users can delete own expense PDFs"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'expense-pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pending_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER pending_expenses_updated_at
  BEFORE UPDATE ON pending_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_expenses_updated_at();

-- Comment for documentation
COMMENT ON TABLE pending_expenses IS 'Stores incoming expense invoices that require review and approval before being converted to transactions';
