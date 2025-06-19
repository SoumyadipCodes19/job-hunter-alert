/*
  # Job Hunter Alert Database Schema

  1. New Tables
    - Updates existing `jobs` table structure to match scraper requirements
    - `profiles` table for user profiles
    - `tracked_companies` table for companies to scrape
    - `keywords` table for job matching keywords
    - `notifications` table for job match notifications

  2. Security
    - Enable RLS on all tables
    - Add policies for user data access control
    - Create trigger for automatic profile creation

  3. Changes
    - Modify existing jobs table to support scraper functionality
    - Add foreign key relationships between tables
    - Set up automatic user profile creation
*/

-- First, let's modify the existing jobs table to support the scraper functionality
-- Add new columns needed for the scraper
DO $$
BEGIN
  -- Add company_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN company_id UUID;
  END IF;

  -- Add url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'url'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN url TEXT;
  END IF;

  -- Add description column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN description TEXT;
  END IF;

  -- Add location column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'location'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN location TEXT;
  END IF;

  -- Add posted_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'posted_date'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN posted_date TIMESTAMPTZ;
  END IF;

  -- Add scraped_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'scraped_at'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN scraped_at TIMESTAMPTZ DEFAULT now();
  END IF;

  -- Add is_new column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'is_new'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN is_new BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Create user profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Create tracked companies table
CREATE TABLE IF NOT EXISTS public.tracked_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  career_page_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Create keywords table
CREATE TABLE IF NOT EXISTS public.keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  keyword_matched TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_sent BOOLEAN DEFAULT false,
  PRIMARY KEY (id)
);

-- Add foreign key constraint for jobs.company_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_company_id_fkey'
  ) THEN
    ALTER TABLE public.jobs 
    ADD CONSTRAINT jobs_company_id_fkey 
    FOREIGN KEY (company_id) REFERENCES public.tracked_companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint for jobs to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_company_id_title_url_key'
  ) THEN
    ALTER TABLE public.jobs 
    ADD CONSTRAINT jobs_company_id_title_url_key 
    UNIQUE (company_id, title, url);
  END IF;
END $$;

-- Enable Row Level Security on new tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for tracked_companies
CREATE POLICY "Users can manage their own tracked companies" ON public.tracked_companies
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for keywords
CREATE POLICY "Users can manage their own keywords" ON public.keywords
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Update jobs table RLS policy to allow viewing jobs from tracked companies
DROP POLICY IF EXISTS "Users can view jobs from their tracked companies" ON public.jobs;
CREATE POLICY "Users can view jobs from their tracked companies" ON public.jobs
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM public.tracked_companies 
      WHERE user_id = auth.uid()
    )
  );

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup (drop first if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();