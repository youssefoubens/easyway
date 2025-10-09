/*
  # Initial Database Schema for Automated Internship Application Platform

  ## Overview
  This migration creates the complete database schema for the internship application platform,
  including tables for resumes, internship posts, email contacts, and applications.

  ## 1. New Tables

  ### `resumes`
  Stores user resume information and parsed content
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `file_url` (text) - Path to resume file in Supabase Storage
  - `parsed_content` (jsonb) - Full parsed resume data
  - `education` (text[]) - Array of education entries
  - `skills` (text[]) - Array of skills
  - `experience` (jsonb[]) - Array of work experience objects
  - `projects` (jsonb[]) - Array of project objects
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `internship_posts`
  Stores internship opportunities added by users
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `company_name` (text)
  - `position_title` (text)
  - `description` (text)
  - `contact_email` (text, nullable)
  - `extracted_emails` (text[]) - Emails extracted by AI
  - `company_activity` (text, nullable)
  - `industry_sector` (text, nullable)
  - `deadline` (date, nullable)
  - `post_url` (text, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `email_contacts`
  Stores manually added company email contacts
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `company_name` (text)
  - `email` (text)
  - `industry` (text, nullable)
  - `notes` (text, nullable)
  - `created_at` (timestamptz)

  ### `applications`
  Tracks all email applications sent by users
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `post_id` (uuid, nullable, foreign key to internship_posts)
  - `contact_id` (uuid, nullable, foreign key to email_contacts)
  - `recipient_email` (text)
  - `subject` (text)
  - `email_body` (text)
  - `ai_generated` (boolean, default true)
  - `status` (text) - 'draft', 'sent', 'failed', 'scheduled'
  - `sent_at` (timestamptz, nullable)
  - `scheduled_for` (timestamptz, nullable)
  - `error_message` (text, nullable)
  - `created_at` (timestamptz)

  ## 2. Security
  
  All tables have Row Level Security (RLS) enabled with the following policies:
  
  ### Resumes
  - Users can only view, insert, update, and delete their own resumes
  
  ### Internship Posts
  - Users can only view, insert, update, and delete their own posts
  
  ### Email Contacts
  - Users can only view, insert, update, and delete their own contacts
  
  ### Applications
  - Users can only view, insert, update, and delete their own applications

  ## 3. Indexes
  
  Created indexes on foreign keys and commonly queried columns for performance:
  - user_id columns in all tables
  - status column in applications table
  - created_at columns for sorting
*/

-- Create resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url text NOT NULL,
  parsed_content jsonb DEFAULT '{}'::jsonb,
  education text[] DEFAULT ARRAY[]::text[],
  skills text[] DEFAULT ARRAY[]::text[],
  experience jsonb[] DEFAULT ARRAY[]::jsonb[],
  projects jsonb[] DEFAULT ARRAY[]::jsonb[],
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create internship_posts table
CREATE TABLE IF NOT EXISTS internship_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL,
  position_title text NOT NULL,
  description text NOT NULL,
  contact_email text,
  extracted_emails text[] DEFAULT ARRAY[]::text[],
  company_activity text,
  industry_sector text,
  deadline date,
  post_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create email_contacts table
CREATE TABLE IF NOT EXISTS email_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL,
  email text NOT NULL,
  industry text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES internship_posts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES email_contacts(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  email_body text NOT NULL,
  ai_generated boolean DEFAULT true NOT NULL,
  status text DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'sent', 'failed', 'scheduled')),
  sent_at timestamptz,
  scheduled_for timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security on all tables
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resumes table
CREATE POLICY "Users can view own resumes"
  ON resumes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes"
  ON resumes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes"
  ON resumes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes"
  ON resumes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for internship_posts table
CREATE POLICY "Users can view own posts"
  ON internship_posts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts"
  ON internship_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON internship_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON internship_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for email_contacts table
CREATE POLICY "Users can view own contacts"
  ON email_contacts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
  ON email_contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON email_contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
  ON email_contacts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for applications table
CREATE POLICY "Users can view own applications"
  ON applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
  ON applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
  ON applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications"
  ON applications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS resumes_user_id_idx ON resumes(user_id);
CREATE INDEX IF NOT EXISTS resumes_created_at_idx ON resumes(created_at DESC);

CREATE INDEX IF NOT EXISTS internship_posts_user_id_idx ON internship_posts(user_id);
CREATE INDEX IF NOT EXISTS internship_posts_created_at_idx ON internship_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS internship_posts_deadline_idx ON internship_posts(deadline);

CREATE INDEX IF NOT EXISTS email_contacts_user_id_idx ON email_contacts(user_id);
CREATE INDEX IF NOT EXISTS email_contacts_created_at_idx ON email_contacts(created_at DESC);

CREATE INDEX IF NOT EXISTS applications_user_id_idx ON applications(user_id);
CREATE INDEX IF NOT EXISTS applications_status_idx ON applications(status);
CREATE INDEX IF NOT EXISTS applications_created_at_idx ON applications(created_at DESC);
CREATE INDEX IF NOT EXISTS applications_post_id_idx ON applications(post_id);
CREATE INDEX IF NOT EXISTS applications_contact_id_idx ON applications(contact_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_resumes_updated_at
  BEFORE UPDATE ON resumes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_internship_posts_updated_at
  BEFORE UPDATE ON internship_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();