-- Users table (simplified: can be expanded with more profile info or auth integration)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE, -- Optional, for identifying teachers if you add auth
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to the user who created it
    title TEXT NOT NULL,
    exam_code TEXT UNIQUE NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ, -- When the exam can be started by students
    duration_minutes INTEGER NOT NULL, -- Duration in minutes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to generate a unique exam code
CREATE OR REPLACE FUNCTION generate_exam_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  found TEXT;
BEGIN
  LOOP
    new_code := upper(substring(md5(random()::text) for 6));
    SELECT exam_code INTO found FROM exams WHERE exam_code = new_code;
    IF NOT found IS NULL THEN
      CONTINUE;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;


-- Question types enum
CREATE TYPE question_type AS ENUM ('text', 'multiple_choice', 'file_upload');

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    type question_type NOT NULL DEFAULT 'text',
    options JSONB, -- For multiple_choice: [{ "text": "Option A", "is_correct": true/false }, ...]
    -- For file_upload questions, the teacher might upload a reference image/file
    teacher_attachment_url TEXT, 
    teacher_attachment_filename TEXT,
    points INTEGER DEFAULT 10,
    sort_order SERIAL -- To maintain question order
);

-- Student Exam Sessions table
-- Tracks when a student joins an exam
CREATE TABLE IF NOT EXISTS student_exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_identifier TEXT NOT NULL, -- Could be a user ID if full auth, or a session ID/name
    join_time TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'started', -- e.g., 'started', 'submitted', 'timed_out'
    UNIQUE (exam_id, student_identifier) -- A student can only have one session per exam
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES student_exam_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    selected_option_index INTEGER, -- For multiple choice
    answer_file_url TEXT, -- For file upload answers from students
    answer_file_filename TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    score INTEGER -- Optional: if auto-grading or manual grading is implemented
);

-- Enable Row Level Security (RLS) - good practice
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (you'll need to refine these based on your auth setup)
-- Allow public read access to exams for joining
CREATE POLICY "Allow public read access to exams" ON exams
FOR SELECT USING (true);

-- Allow individuals to manage their own exams (if you implement user auth for hosts)
-- CREATE POLICY "Allow host to manage their exams" ON exams
-- FOR ALL USING (auth.uid() = host_id)
-- WITH CHECK (auth.uid() = host_id);

-- Allow students to read questions of an exam they've joined
-- This requires joining with student_exam_sessions and checking student_identifier
-- CREATE POLICY "Allow joined students to read questions" ON questions
-- FOR SELECT USING (
--   EXISTS (
--     SELECT 1 FROM student_exam_sessions ses
--     WHERE ses.exam_id = questions.exam_id AND ses.student_identifier = current_setting('request.jwt.claims', true)::jsonb->>'sub' -- or however you identify student
--   )
-- );

-- Allow students to manage their own submissions
-- CREATE POLICY "Allow students to manage their submissions" ON submissions
-- FOR ALL USING (
--   EXISTS (
--     SELECT 1 FROM student_exam_sessions ses
--     WHERE ses.id = submissions.session_id AND ses.student_identifier = current_setting('request.jwt.claims', true)::jsonb->>'sub'
--   )
-- )
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM student_exam_sessions ses
--     WHERE ses.id = submissions.session_id AND ses.student_identifier = current_setting('request.jwt.claims', true)::jsonb->>'sub'
--   )
-- );

-- Create Supabase Storage bucket for exam attachments and student uploads
-- You might need to do this via the Supabase Dashboard UI if you prefer.
-- The policies below are very open for demonstration; tighten them in production.
-- insert into storage.buckets (id, name, public) values ('exam_files', 'exam_files', false);

-- CREATE POLICY "Allow authenticated users to upload to exam_files"
-- ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exam_files');

-- CREATE POLICY "Allow users to read their own files or public files"
-- ON storage.objects FOR SELECT USING (
--   bucket_id = 'exam_files' AND (
--     auth.uid() = owner OR (get_path_star(storage.foldername(name)) ->> 'public')::boolean = true
--   )
-- );

-- Trigger to automatically update `updated_at` timestamp on exams
  CREATE OR REPLACE FUNCTION trigger_set_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER set_exam_timestamp
  BEFORE UPDATE ON exams
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();
