-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('applied', 'interviewing', 'offered', 'rejected')),
    CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view their own jobs
CREATE POLICY "Users can view their own jobs"
    ON public.jobs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own jobs
CREATE POLICY "Users can insert their own jobs"
    ON public.jobs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own jobs
CREATE POLICY "Users can update their own jobs"
    ON public.jobs
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to delete their own jobs
CREATE POLICY "Users can delete their own jobs"
    ON public.jobs
    FOR DELETE
    USING (auth.uid() = user_id); 