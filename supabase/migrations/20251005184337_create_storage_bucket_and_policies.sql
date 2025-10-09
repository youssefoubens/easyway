/*
  # Create Storage Bucket for Resumes

  ## Overview
  This migration creates a storage bucket for resume files and configures
  the necessary security policies.

  ## 1. Storage Bucket
  
  ### `resumes` bucket
  - Private bucket for storing user resume files (PDF, DOCX)
  - Files organized by user_id folders
  - Maximum file size: 5MB (enforced at application level)

  ## 2. Security Policies
  
  ### Upload Policy
  - Users can only upload files to their own folder (user_id subfolder)
  - Authenticated users only
  
  ### Select Policy
  - Users can only view files in their own folder
  - Authenticated users only
  
  ### Update Policy
  - Users can update files in their own folder
  - Authenticated users only
  
  ### Delete Policy
  - Users can delete files from their own folder
  - Authenticated users only

  ## 3. Important Notes
  
  - All resume files must be stored in a path like: {user_id}/filename.pdf
  - The user_id is extracted from the file path and compared to auth.uid()
  - This ensures users cannot access other users' resumes
*/

-- Create the resumes storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  5242880, -- 5MB in bytes
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO NOTHING;

-- Policy for uploading resumes (INSERT)
CREATE POLICY "Users can upload own resumes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy for viewing resumes (SELECT)
CREATE POLICY "Users can view own resumes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy for updating resumes (UPDATE)
CREATE POLICY "Users can update own resumes"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy for deleting resumes (DELETE)
CREATE POLICY "Users can delete own resumes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );