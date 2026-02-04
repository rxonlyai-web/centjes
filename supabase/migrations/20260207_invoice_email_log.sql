-- Invoice email sending log
CREATE TABLE IF NOT EXISTS invoice_email_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid REFERENCES invoices ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations,
  sent_to text NOT NULL,
  sent_by uuid REFERENCES auth.users NOT NULL,
  sent_at timestamptz DEFAULT now() NOT NULL,
  resend_id text,
  status text DEFAULT 'sent'
);

-- RLS
ALTER TABLE invoice_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email logs"
  ON invoice_email_log FOR SELECT
  USING (sent_by = auth.uid() OR organization_id IN (SELECT user_org_ids(auth.uid())));

CREATE POLICY "Users can insert email logs"
  ON invoice_email_log FOR INSERT
  WITH CHECK (sent_by = auth.uid());

-- Index
CREATE INDEX idx_invoice_email_log_invoice ON invoice_email_log(invoice_id);
