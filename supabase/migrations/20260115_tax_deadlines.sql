-- Create tax_deadlines table for tracking Dutch tax deadlines
CREATE TABLE tax_deadlines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  deadline_type text NOT NULL CHECK (deadline_type IN ('inkomstenbelasting', 'btw_q1', 'btw_q2', 'btw_q3', 'btw_q4')),
  tax_year integer NOT NULL,
  deadline_date date NOT NULL,
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, deadline_type, tax_year)
);

-- Enable RLS
ALTER TABLE tax_deadlines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own deadlines" ON tax_deadlines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own deadlines" ON tax_deadlines
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deadlines" ON tax_deadlines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_tax_deadlines_user_year ON tax_deadlines(user_id, tax_year);
CREATE INDEX idx_tax_deadlines_date ON tax_deadlines(deadline_date);
