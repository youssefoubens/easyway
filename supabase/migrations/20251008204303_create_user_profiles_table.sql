/*
  # Update User Profiles Table

  ## Overview
  This migration updates the user_profiles table with additional fields
  to enhance AI-generated application personalization and user experience.

  ## Changes Made:
  
  1. Add more profile fields for better AI personalization
  2. Add profile completeness tracking
  3. Add social media links
  4. Add preferences for application automation
  5. Add trigger for updated_at timestamp

  ## New Fields:
  - `profile_picture_url` - Avatar/profile photo
  - `github_url` - GitHub profile
  - `portfolio_url` - Personal website/portfolio
  - `twitter_url` - Twitter/X profile
  - `years_of_experience` - Work experience duration
  - `education_level` - Highest education completed
  - `preferred_locations` - Array of preferred work locations
  - `preferred_work_type` - Remote, hybrid, or onsite
  - `availability_date` - When user can start
  - `salary_expectation` - Expected salary range
  - `profile_completeness` - Percentage of profile filled
  - `email_signature` - Custom email signature for applications
  - `notification_preferences` - JSON for notification settings
  - `is_profile_public` - Whether profile is visible to others

  ## Benefits:
  - Better AI-generated cover letters and emails
  - More personalized job matching
  - Professional email signatures
  - Track profile completion for better user experience
*/

-- Add new columns to existing user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS profile_picture_url text,
ADD COLUMN IF NOT EXISTS github_url text,
ADD COLUMN IF NOT EXISTS portfolio_url text,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS years_of_experience integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS education_level text CHECK (education_level IN ('high_school', 'associate', 'bachelor', 'master', 'phd', 'other')),
ADD COLUMN IF NOT EXISTS preferred_locations text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS preferred_work_type text DEFAULT 'remote' CHECK (preferred_work_type IN ('remote', 'hybrid', 'onsite', 'flexible')),
ADD COLUMN IF NOT EXISTS availability_date date,
ADD COLUMN IF NOT EXISTS salary_expectation text,
ADD COLUMN IF NOT EXISTS profile_completeness integer DEFAULT 0 CHECK (profile_completeness >= 0 AND profile_completeness <= 100),
ADD COLUMN IF NOT EXISTS email_signature text,
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "email_on_application_sent": true,
  "email_on_application_failed": true,
  "weekly_summary": true,
  "new_opportunities": true
}'::jsonb,
ADD COLUMN IF NOT EXISTS is_profile_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS language_preference text DEFAULT 'en';

-- Create index for public profiles
CREATE INDEX IF NOT EXISTS user_profiles_public_idx ON user_profiles(is_profile_public) 
WHERE is_profile_public = true;

-- Create index for target industry searches
CREATE INDEX IF NOT EXISTS user_profiles_industry_idx ON user_profiles(target_industry);

-- Add RLS policy for public profiles (if users want to share)
CREATE POLICY "Public profiles are viewable by all"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_profile_public = true);

-- Create or replace function to calculate profile completeness
CREATE OR REPLACE FUNCTION calculate_profile_completeness()
RETURNS TRIGGER AS $$
DECLARE
  completeness integer := 0;
  total_fields integer := 15; -- Total number of important fields
BEGIN
  -- Check each important field and add points
  IF NEW.full_name IS NOT NULL AND NEW.full_name != '' THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.linkedin_url IS NOT NULL AND NEW.linkedin_url != '' THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.bio IS NOT NULL AND NEW.bio != '' THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.target_position IS NOT NULL AND NEW.target_position != '' THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.target_industry IS NOT NULL AND NEW.target_industry != '' THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.profile_picture_url IS NOT NULL AND NEW.profile_picture_url != '' THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.github_url IS NOT NULL AND NEW.github_url != '' THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.portfolio_url IS NOT NULL AND NEW.portfolio_url != '' THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.years_of_experience IS NOT NULL AND NEW.years_of_experience > 0 THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.education_level IS NOT NULL THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.preferred_locations IS NOT NULL AND array_length(NEW.preferred_locations, 1) > 0 THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.availability_date IS NOT NULL THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.salary_expectation IS NOT NULL AND NEW.salary_expectation != '' THEN
    completeness := completeness + 1;
  END IF;
  
  IF NEW.email_signature IS NOT NULL AND NEW.email_signature != '' THEN
    completeness := completeness + 1;
  END IF;
  
  -- Calculate percentage
  NEW.profile_completeness := (completeness * 100) / total_fields;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate profile completeness
DROP TRIGGER IF EXISTS calculate_user_profile_completeness ON user_profiles;
CREATE TRIGGER calculate_user_profile_completeness
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION calculate_profile_completeness();

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- Add helpful comments
COMMENT ON COLUMN user_profiles.profile_completeness IS 'Automatically calculated percentage of profile completion (0-100)';
COMMENT ON COLUMN user_profiles.email_signature IS 'Custom signature to append to application emails';
COMMENT ON COLUMN user_profiles.notification_preferences IS 'JSON object storing user notification preferences';
COMMENT ON COLUMN user_profiles.is_profile_public IS 'If true, other users can view this profile (for networking)';
COMMENT ON COLUMN user_profiles.preferred_locations IS 'Array of cities/regions where user wants to work';
COMMENT ON COLUMN user_profiles.preferred_work_type IS 'Work arrangement preference: remote, hybrid, onsite, or flexible';