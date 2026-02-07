-- Performance indexes for common query patterns

-- Compound index for the most common query pattern (user + date range filtering)
CREATE INDEX IF NOT EXISTS idx_transacties_user_datum
  ON transacties(gebruiker_id, datum DESC);

-- Index for invoice lookups by user
CREATE INDEX IF NOT EXISTS idx_invoices_user_id
  ON invoices(user_id);

-- Index for invoice items by invoice
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON invoice_items(invoice_id);
