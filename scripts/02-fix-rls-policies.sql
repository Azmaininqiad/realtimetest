-- Disable RLS temporarily for development, or create permissive policies
-- Option 1: Disable RLS entirely (simpler for development)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_exam_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;

-- Option 2: If you prefer to keep RLS enabled, uncomment the policies below instead
-- and comment out the DISABLE statements above

-- Allow anonymous users to perform all operations (very permissive - for development only)
-- CREATE POLICY "Allow anonymous access to users" ON users FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow anonymous access to exams" ON exams FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow anonymous access to questions" ON questions FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow anonymous access to sessions" ON student_exam_sessions FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow anonymous access to submissions" ON submissions FOR ALL USING (true) WITH CHECK (true);

-- Create the storage bucket if it doesn't exist (you can also do this via UI)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('exam_files', 'exam_files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the exam_files bucket
CREATE POLICY "Allow anonymous uploads to exam_files"
ON storage.objects FOR INSERT 
TO anon
WITH CHECK (bucket_id = 'exam_files');

CREATE POLICY "Allow anonymous downloads from exam_files"
ON storage.objects FOR SELECT 
TO anon
USING (bucket_id = 'exam_files');

CREATE POLICY "Allow public access to exam_files"
ON storage.objects FOR SELECT 
TO public
USING (bucket_id = 'exam_files');
