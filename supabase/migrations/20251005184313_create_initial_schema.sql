/*
  # Update Database Schema for Multiple Resumes and Public Contacts
  
  ## Overview
  This migration updates the existing database to support:
  1. Multiple resumes per user (with active resume tracking)
  2. Public company contacts visible to all users
  3. Contact voting/rating system
  
  ## Changes Made:
  
  ### Resumes Table Updates:
  - Add `is_active` column to mark which resume is currently active
  - Add `resume_name` column to identify different resume versions
  - Add trigger to ensure only one active resume per user
  
  ### Email Contacts Table Updates:
  - Add public sharing columns (is_public, is_verified, votes)
  - Add detailed contact information fields
  - Update RLS policies to allow viewing public contacts
  
  ### New Tables:
  - `contact_votes` - Track user votes on contact quality
  
  ### New Views:
  - `public_contacts_view` - Easy access to all public contacts with scores
*/

-- ============================================
-- 1. UPDATE RESUMES TABLE FOR MULTIPLE RESUMES
-- ============================================

-- Add is_active column to mark the currently active resume
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add resume_name to help users identify different versions
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS resume_name text DEFAULT 'My Resume';

-- Create index for finding active resume quickly
CREATE INDEX IF NOT EXISTS resumes_user_active_idx ON resumes(user_id, is_active) 
WHERE is_active = true;

-- Function to ensure only one active resume per user
CREATE OR REPLACE FUNCTION ensure_single_active_resume()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new/updated resume is set to active
  IF NEW.is_active = true THEN
    -- Deactivate all other resumes for this user
    UPDATE resumes 
    SET is_active = false 
    WHERE user_id = NEW.user_id 
      AND id != NEW.id 
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single active resume
DROP TRIGGER IF EXISTS enforce_single_active_resume ON resumes;
CREATE TRIGGER enforce_single_active_resume
  BEFORE INSERT OR UPDATE ON resumes
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_resume();


-- ============================================
-- 2. UPDATE EMAIL_CONTACTS FOR PUBLIC SHARING
-- ============================================

-- Add columns for public contact sharing
ALTER TABLE email_contacts 
ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_date timestamptz,
ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS contribution_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_verified timestamptz,
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS upvotes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS downvotes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS contact_type text DEFAULT 'recruiter' 
  CHECK (contact_type IN ('recruiter', 'hr', 'manager', 'general'));

-- Add metadata for better contact information
ALTER TABLE email_contacts
ADD COLUMN IF NOT EXISTS contact_person_name text,
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS website text;

-- Create index for public contacts search
CREATE INDEX IF NOT EXISTS email_contacts_public_idx ON email_contacts(is_public, company_name);
CREATE INDEX IF NOT EXISTS email_contacts_industry_idx ON email_contacts(industry);
CREATE INDEX IF NOT EXISTS email_contacts_verified_idx ON email_contacts(is_verified);

-- Drop existing restrictive RLS policies for email_contacts
DROP POLICY IF EXISTS "Users can view own contacts" ON email_contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON email_contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON email_contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON email_contacts;

-- Create new RLS policies for public sharing

-- Anyone can view public contacts
CREATE POLICY "Anyone can view public contacts"
  ON email_contacts FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Users can view their own private contacts
CREATE POLICY "Users can view own private contacts"
  ON email_contacts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_public = false);

-- Anyone can insert new contacts (they become public by default)
CREATE POLICY "Users can insert contacts"
  ON email_contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own contacts
CREATE POLICY "Users can update own contacts"
  ON email_contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own contacts
CREATE POLICY "Users can delete own contacts"
  ON email_contacts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================
-- 3. CREATE CONTACT VOTES TABLE
-- ============================================

-- Table to track user votes on contacts (helpful/not helpful)
CREATE TABLE IF NOT EXISTS contact_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES email_contacts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote_type text NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(contact_id, user_id) -- One vote per user per contact
);

-- Enable RLS on contact_votes
ALTER TABLE contact_votes ENABLE ROW LEVEL SECURITY;

-- Users can view all votes
CREATE POLICY "Users can view all votes"
  ON contact_votes FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own votes
CREATE POLICY "Users can insert own votes"
  ON contact_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes
CREATE POLICY "Users can update own votes"
  ON contact_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete own votes"
  ON contact_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for votes
CREATE INDEX IF NOT EXISTS contact_votes_contact_idx ON contact_votes(contact_id);
CREATE INDEX IF NOT EXISTS contact_votes_user_idx ON contact_votes(user_id);


-- ============================================
-- 4. CREATE FUNCTION TO UPDATE VOTE COUNTS
-- ============================================

CREATE OR REPLACE FUNCTION update_contact_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate upvotes and downvotes for the contact
  UPDATE email_contacts
  SET 
    upvotes = (
      SELECT COUNT(*) 
      FROM contact_votes 
      WHERE contact_id = COALESCE(NEW.contact_id, OLD.contact_id) 
        AND vote_type = 'up'
    ),
    downvotes = (
      SELECT COUNT(*) 
      FROM contact_votes 
      WHERE contact_id = COALESCE(NEW.contact_id, OLD.contact_id) 
        AND vote_type = 'down'
    )
  WHERE id = COALESCE(NEW.contact_id, OLD.contact_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update vote counts
DROP TRIGGER IF EXISTS update_vote_counts ON contact_votes;
CREATE TRIGGER update_vote_counts
  AFTER INSERT OR UPDATE OR DELETE ON contact_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_vote_counts();


-- ============================================
-- 5. CREATE VIEW FOR PUBLIC CONTACT DISCOVERY
-- ============================================

CREATE OR REPLACE VIEW public_contacts_view AS
SELECT 
  ec.id,
  ec.company_name,
  ec.email,
  ec.industry,
  ec.contact_person_name,
  ec.position,
  ec.phone,
  ec.location,
  ec.website,
  ec.contact_type,
  ec.notes,
  ec.is_verified,
  ec.verification_date,
  ec.upvotes,
  ec.downvotes,
  ec.created_at,
  up.full_name as contributor_name,
  (ec.upvotes - ec.downvotes) as score
FROM email_contacts ec
LEFT JOIN user_profiles up ON ec.user_id = up.user_id
WHERE ec.is_public = true
ORDER BY (ec.upvotes - ec.downvotes) DESC, ec.created_at DESC;


-- ============================================
-- 6. HELPFUL COMMENTS
-- ============================================

COMMENT ON COLUMN resumes.is_active IS 'Marks which resume is currently active for applications';
COMMENT ON COLUMN resumes.resume_name IS 'User-friendly name to identify different resume versions';
COMMENT ON COLUMN email_contacts.is_public IS 'When true, contact is visible to all users';
COMMENT ON COLUMN email_contacts.is_verified IS 'Marks if contact has been verified as working';
COMMENT ON COLUMN email_contacts.upvotes IS 'Number of users who found this contact helpful';
COMMENT ON COLUMN email_contacts.downvotes IS 'Number of users who found this contact not helpful';
COMMENT ON TABLE contact_votes IS 'Tracks user votes on contact quality';
COMMENT ON VIEW public_contacts_view IS 'Public view of all shared contacts with contributor info';