-- Tabel voor Gmail connecties per user
CREATE TABLE IF NOT EXISTS user_gmail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_address VARCHAR(255) NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT unique_user_gmail UNIQUE(user_id),
  CONSTRAINT unique_gmail_address UNIQUE(gmail_address),
  CONSTRAINT valid_gmail_format CHECK (gmail_address ~* '^[A-Za-z0-9._%+-]+@gmail\.com$')
);

-- Indexes voor snelle lookups
CREATE INDEX IF NOT EXISTS idx_gmail_connections_user ON user_gmail_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_email ON user_gmail_connections(gmail_address);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_active ON user_gmail_connections(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE user_gmail_connections ENABLE ROW LEVEL SECURITY;

-- Users kunnen alleen hun eigen connectie zien
CREATE POLICY "Users can view own gmail connection"
  ON user_gmail_connections
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users kunnen alleen hun eigen connectie aanmaken
CREATE POLICY "Users can create own gmail connection"
  ON user_gmail_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users kunnen alleen hun eigen connectie updaten
CREATE POLICY "Users can update own gmail connection"
  ON user_gmail_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users kunnen alleen hun eigen connectie verwijderen
CREATE POLICY "Users can delete own gmail connection"
  ON user_gmail_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comment voor documentatie
COMMENT ON TABLE user_gmail_connections IS 'Stores Gmail account connections for automated invoice processing per user';
