export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      resumes: {
        Row: {
          id: string
          user_id: string
          file_url: string
          parsed_content: Json
          education: string[]
          skills: string[]
          experience: Json[]
          projects: Json[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_url: string
          parsed_content?: Json
          education?: string[]
          skills?: string[]
          experience?: Json[]
          projects?: Json[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_url?: string
          parsed_content?: Json
          education?: string[]
          skills?: string[]
          experience?: Json[]
          projects?: Json[]
          created_at?: string
          updated_at?: string
        }
      }
      internship_posts: {
        Row: {
          id: string
          user_id: string
          company_name: string
          position_title: string
          description: string
          contact_email: string | null
          extracted_emails: string[]
          company_activity: string | null
          industry_sector: string | null
          deadline: string | null
          post_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name: string
          position_title: string
          description: string
          contact_email?: string | null
          extracted_emails?: string[]
          company_activity?: string | null
          industry_sector?: string | null
          deadline?: string | null
          post_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          position_title?: string
          description?: string
          contact_email?: string | null
          extracted_emails?: string[]
          company_activity?: string | null
          industry_sector?: string | null
          deadline?: string | null
          post_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      email_contacts: {
        Row: {
          id: string
          user_id: string
          company_name: string
          email: string
          industry: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name: string
          email: string
          industry?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          email?: string
          industry?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      applications: {
        Row: {
          id: string
          user_id: string
          post_id: string | null
          contact_id: string | null
          recipient_email: string
          subject: string
          email_body: string
          ai_generated: boolean
          status: 'draft' | 'sent' | 'failed' | 'scheduled'
          sent_at: string | null
          scheduled_for: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          post_id?: string | null
          contact_id?: string | null
          recipient_email: string
          subject: string
          email_body: string
          ai_generated?: boolean
          status?: 'draft' | 'sent' | 'failed' | 'scheduled'
          sent_at?: string | null
          scheduled_for?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          post_id?: string | null
          contact_id?: string | null
          recipient_email?: string
          subject?: string
          email_body?: string
          ai_generated?: boolean
          status?: 'draft' | 'sent' | 'failed' | 'scheduled'
          sent_at?: string | null
          scheduled_for?: string | null
          error_message?: string | null
          created_at?: string
        }
      }
    }
  }
}
