-- Phase 3: Organization model for multi-user (VOF) support

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  business_type text NOT NULL CHECK (business_type IN ('zzp', 'vof')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Organization members
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(organization_id, user_id)
);

-- Organization invites
CREATE TABLE IF NOT EXISTS organization_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  invite_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '7 days') NOT NULL
);

-- Extend profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_type text CHECK (business_type IN ('zzp', 'vof'));

-- Add organization_id to existing tables
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations;
ALTER TABLE transacties ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations;
ALTER TABLE pending_expenses ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations;
ALTER TABLE tax_deadlines ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations;

-- RLS helper function: get org IDs for a user
CREATE OR REPLACE FUNCTION user_org_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organization_id FROM organization_members WHERE user_id = p_user_id;
$$;

-- Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- RLS: organizations — members can view their orgs
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (id IN (SELECT user_org_ids(auth.uid())));

-- RLS: organization_members — members can view members of their orgs
CREATE POLICY "Users can view org members"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT user_org_ids(auth.uid())));

-- RLS: organization_members — owners can insert members
CREATE POLICY "Owners can add org members"
  ON organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- RLS: organization_invites — members can view invites for their orgs
CREATE POLICY "Users can view org invites"
  ON organization_invites FOR SELECT
  USING (organization_id IN (SELECT user_org_ids(auth.uid())));

-- RLS: organization_invites — owners can create invites
CREATE POLICY "Owners can create invites"
  ON organization_invites FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- RLS: organization_invites — allow public read by token (for invite acceptance)
CREATE POLICY "Anyone can read invite by token"
  ON organization_invites FOR SELECT
  USING (true);

-- RLS: organization_invites — allow status update on acceptance
CREATE POLICY "Invite can be accepted"
  ON organization_invites FOR UPDATE
  USING (true)
  WITH CHECK (status = 'accepted');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_org_invites_org ON organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_transacties_org ON transacties(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_org ON company_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_pending_expenses_org ON pending_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_deadlines_org ON tax_deadlines(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);

-- Data migration: create organizations for existing users with company_settings
DO $$
DECLARE
  r RECORD;
  new_org_id uuid;
BEGIN
  FOR r IN
    SELECT cs.user_id, cs.company_name, cs.id as settings_id
    FROM company_settings cs
    WHERE cs.organization_id IS NULL
  LOOP
    -- Create organization
    INSERT INTO organizations (name, business_type)
    VALUES (COALESCE(r.company_name, 'Mijn bedrijf'), 'zzp')
    RETURNING id INTO new_org_id;

    -- Create owner membership
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (new_org_id, r.user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    -- Update company_settings
    UPDATE company_settings SET organization_id = new_org_id
    WHERE id = r.settings_id;

    -- Backfill organization_id on user's data
    UPDATE transacties SET organization_id = new_org_id
    WHERE gebruiker_id = r.user_id AND organization_id IS NULL;

    UPDATE invoices SET organization_id = new_org_id
    WHERE user_id = r.user_id AND organization_id IS NULL;

    UPDATE pending_expenses SET organization_id = new_org_id
    WHERE user_id = r.user_id AND organization_id IS NULL;

    UPDATE tax_deadlines SET organization_id = new_org_id
    WHERE user_id = r.user_id AND organization_id IS NULL;

    UPDATE documents SET organization_id = new_org_id
    WHERE user_id = r.user_id AND organization_id IS NULL;

    -- Mark onboarding as completed for existing users
    INSERT INTO profiles (id, onboarding_completed, business_type)
    VALUES (r.user_id, true, 'zzp')
    ON CONFLICT (id) DO UPDATE SET onboarding_completed = true, business_type = 'zzp';
  END LOOP;
END $$;
