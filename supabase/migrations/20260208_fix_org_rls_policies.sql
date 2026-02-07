-- Fix: Missing INSERT policies for organizations and organization_members
-- This migration addresses the chicken-and-egg problem where new users can't create
-- their first organization because RLS blocks all INSERT operations by default.

-- Fix 1: Allow authenticated users to create organizations
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fix 2: Allow users to create their OWN initial membership (only for themselves)
-- This enables the onboarding flow where a user creates an org and joins as owner
CREATE POLICY "Users can create their own membership"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Fix 3: Allow owners to update their organizations
CREATE POLICY "Owners can update their organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (id IN (SELECT user_org_ids(auth.uid())))
  WITH CHECK (id IN (SELECT user_org_ids(auth.uid())));

-- Fix 4: Allow owners to delete members (needed for removing vennoot)
CREATE POLICY "Owners can remove org members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
