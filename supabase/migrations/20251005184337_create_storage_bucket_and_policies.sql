/*
  # Update Storage Bucket for Multiple Resumes

  ## Overview
  This migration updates the storage bucket configuration to support
  multiple resume files per user with better organization.

  ## Changes Made:
  
  1. Increase file size limit to 10MB (from 5MB) to support larger resumes
  2. Add support for more document formats
  3. File naming convention updated to support multiple resumes:
     - Format: {user_id}/{resume_name}_{timestamp}.pdf
     - Example: a1b2c3d4-e5f6-7890/Software_Engineer_Resume_1697123456.pdf

  ## Storage Structure:
  
  ```
  resumes/
    ├── {user_id}/
    │   ├── General_Resume_1697123456.pdf
    │   ├── Tech_Resume_1697234567.pdf
    │   └── Marketing_Resume_1697345678.docx
  ```

  ## Security:
  - Users can only access files in their own folder
  - All policies remain user-scoped for security
  - Support for multiple file uploads per user

  ## Supported File Types:
  - PDF (.pdf)
  - Word Documents (.docx, .doc)
  - Rich Text Format (.rtf)
  - Plain Text (.txt)
*/

-- Update the resumes storage bucket configuration
-- Note: We use UPDATE instead of INSERT since bucket already exists
UPDATE storage.buckets 
SET 
  file_size_limit = 10485760, -- 10MB in bytes (increased from 5MB)
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'application/msword', -- .doc
    'application/rtf', -- .rtf
    'text/rtf', -- .rtf alternative MIME type
    'text/plain' -- .txt
  ]
WHERE id = 'resumes';

-- Drop existing storage policies to update them
DROP POLICY IF EXISTS "Users can upload own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own resumes" ON storage.objects;

-- Recreate policies with better naming for multiple resumes support

-- Policy for uploading resumes (INSERT)
-- Allows users to upload multiple files to their folder
CREATE POLICY "Users can upload multiple resumes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy for viewing resumes (SELECT)
-- Users can view all their resume files
CREATE POLICY "Users can view their resumes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy for updating resumes (UPDATE)
-- Users can update metadata of their resume files
CREATE POLICY "Users can update their resumes"
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
-- Users can delete any of their resume files
CREATE POLICY "Users can delete their resumes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Add helpful comment
COMMENT ON TABLE storage.objects IS 'Storage for user resume files. Each user can have multiple resumes stored in their own folder.';