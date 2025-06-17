-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exams_exam_code ON exams(exam_code);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_sort_order ON questions(exam_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_student_sessions_exam_student ON student_exam_sessions(exam_id, student_identifier);
CREATE INDEX IF NOT EXISTS idx_submissions_session_id ON submissions(session_id);

-- Make sure the questions have proper sort_order
UPDATE questions 
SET sort_order = subq.row_num 
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY exam_id ORDER BY id) as row_num
  FROM questions 
  WHERE sort_order IS NULL
) subq 
WHERE questions.id = subq.id;
