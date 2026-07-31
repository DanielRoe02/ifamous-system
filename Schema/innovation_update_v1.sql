-- I-FAMOUS Innovation Update v1
-- Prepared by the code patch. Review and run only after backing up the database.
-- This file is NOT executed by the Python patch.

DELIMITER $$
DROP PROCEDURE IF EXISTS add_column_if_missing$$
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_column_if_missing('fyp_projects', 'github_url', 'VARCHAR(500) NULL');
CALL add_column_if_missing('fyp_projects', 'google_drive_url', 'VARCHAR(500) NULL');
CALL add_column_if_missing('fyp_projects', 'examiner_user_id', 'INT NULL');
CALL add_column_if_missing('fyp_projects', 'examiner_name', 'VARCHAR(255) NULL');
CALL add_column_if_missing('fyp_projects', 'examiner_email', 'VARCHAR(255) NULL');
CALL add_column_if_missing('fyp_projects', 'proposal_approved_at', 'DATETIME NULL');
CALL add_column_if_missing('fyp_projects', 'final_approved_at', 'DATETIME NULL');
CALL add_column_if_missing('fyp_projects', 'approved_submission_id', 'INT NULL');
CALL add_column_if_missing('fyp_projects', 'current_phase', 'VARCHAR(100) NULL DEFAULT ''Proposal''');
CALL add_column_if_missing('fyp_projects', 'progress_percent', 'DECIMAL(5,2) NOT NULL DEFAULT 0');
CALL add_column_if_missing('fyp_projects', 'risk_status', 'VARCHAR(30) NOT NULL DEFAULT ''On Track''');
CALL add_column_if_missing('fyp_projects', 'result_status', 'VARCHAR(40) NULL');
CALL add_column_if_missing('fyp_projects', 'result_released_at', 'DATETIME NULL');
CALL add_column_if_missing('fyp_projects', 'final_score', 'DECIMAL(6,2) NULL');
CALL add_column_if_missing('fyp_projects', 'final_grade', 'VARCHAR(20) NULL');

CALL add_column_if_missing('projects_submissions', 'original_file_name', 'VARCHAR(255) NULL');
CALL add_column_if_missing('projects_submissions', 'mime_type', 'VARCHAR(120) NULL');
CALL add_column_if_missing('projects_submissions', 'feedback', 'TEXT NULL');
CALL add_column_if_missing('projects_submissions', 'reviewed_by', 'INT NULL');
CALL add_column_if_missing('projects_submissions', 'reviewed_at', 'DATETIME NULL');
CALL add_column_if_missing('projects_submissions', 'version_number', 'INT NOT NULL DEFAULT 1');
CALL add_column_if_missing('projects_submissions', 'is_locked', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL add_column_if_missing('projects_submissions', 'uploaded_by', 'INT NULL');

-- Widen the existing submission categories used by the new journey module.
ALTER TABLE projects_submissions
  MODIFY COLUMN submission_type ENUM(
    'proposal','administrative','presentation','progress_report','final_deliverable',
    'logbook','prototype','testing_evidence','feedback_attachment'
  ) NOT NULL,
  MODIFY COLUMN submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INT NOT NULL PRIMARY KEY,
  department VARCHAR(255) NULL,
  organisation VARCHAR(255) NULL,
  biography TEXT NULL,
  profile_photo_url VARCHAR(500) NULL,
  professional_link VARCHAR(500) NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  supervisor_specialisation VARCHAR(500) NULL,
  examiner_specialisation VARCHAR(500) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_supervisor_nominations (
  nomination_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  student_user_id INT NOT NULL,
  supervisor_user_id INT NOT NULL,
  preference_rank INT NOT NULL DEFAULT 1,
  note VARCHAR(500) NULL,
  status ENUM('Nominated','Accepted','Not Selected') NOT NULL DEFAULT 'Nominated',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_student_supervisor_nomination (project_id, student_user_id, supervisor_user_id),
  CONSTRAINT fk_nomination_project FOREIGN KEY (project_id) REFERENCES fyp_projects(project_id) ON DELETE CASCADE,
  CONSTRAINT fk_nomination_student FOREIGN KEY (student_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_nomination_supervisor FOREIGN KEY (supervisor_user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_examiner_assignments (
  assignment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  examiner_user_id INT NOT NULL,
  assigned_by INT NOT NULL,
  status ENUM('Assigned','Reassigned','Removed') NOT NULL DEFAULT 'Assigned',
  match_score DECIMAL(5,2) NULL,
  assignment_reason VARCHAR(500) NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unassigned_at DATETIME NULL,
  completed_at DATETIME NULL,
  INDEX idx_examiner_assignment_project (project_id, status),
  INDEX idx_examiner_assignment_examiner (examiner_user_id, status),
  CONSTRAINT fk_examiner_assignment_project FOREIGN KEY (project_id) REFERENCES fyp_projects(project_id) ON DELETE CASCADE,
  CONSTRAINT fk_examiner_assignment_examiner FOREIGN KEY (examiner_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_examiner_assignment_assigner FOREIGN KEY (assigned_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_milestones (
  milestone_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  due_date DATE NOT NULL,
  status ENUM('Not Started','In Progress','Submitted','Revision Required','Completed','Overdue') NOT NULL DEFAULT 'Not Started',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_milestone_project (project_id, due_date),
  CONSTRAINT fk_milestone_project FOREIGN KEY (project_id) REFERENCES fyp_projects(project_id) ON DELETE CASCADE,
  CONSTRAINT fk_milestone_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_progress_updates (
  progress_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  work_completed TEXT NOT NULL,
  next_work TEXT NOT NULL,
  blockers TEXT NULL,
  evidence_url VARCHAR(500) NULL,
  progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_progress_project (project_id, created_at),
  CONSTRAINT fk_progress_project FOREIGN KEY (project_id) REFERENCES fyp_projects(project_id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_logbooks (
  logbook_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  student_user_id INT NOT NULL,
  meeting_date DATETIME NOT NULL,
  meeting_type VARCHAR(50) NOT NULL DEFAULT 'Physical',
  topics_discussed TEXT NOT NULL,
  progress_summary TEXT NULL,
  problems_identified TEXT NULL,
  supervisor_advice TEXT NULL,
  next_meeting_date DATETIME NULL,
  status ENUM('Pending','Approved','Request Edit') NOT NULL DEFAULT 'Pending',
  supervisor_comment TEXT NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_logbook_project (project_id, meeting_date),
  CONSTRAINT fk_logbook_project FOREIGN KEY (project_id) REFERENCES fyp_projects(project_id) ON DELETE CASCADE,
  CONSTRAINT fk_logbook_student FOREIGN KEY (student_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_logbook_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_action_items (
  action_item_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  logbook_id INT NULL,
  title VARCHAR(500) NOT NULL,
  assigned_to_user_id INT NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('Pending','In Progress','Completed','Overdue','Cancelled') NOT NULL DEFAULT 'Pending',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_action_project (project_id, due_date),
  CONSTRAINT fk_action_project FOREIGN KEY (project_id) REFERENCES fyp_projects(project_id) ON DELETE CASCADE,
  CONSTRAINT fk_action_logbook FOREIGN KEY (logbook_id) REFERENCES fyp_logbooks(logbook_id) ON DELETE SET NULL,
  CONSTRAINT fk_action_assignee FOREIGN KEY (assigned_to_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_action_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_feedback (
  feedback_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  submission_id INT NULL,
  author_user_id INT NOT NULL,
  author_role ENUM('Supervisor','Examiner','Coordinator') NOT NULL,
  comment TEXT NOT NULL,
  attachment_path VARCHAR(500) NULL,
  attachment_name VARCHAR(255) NULL,
  attachment_mime VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_project (project_id, created_at),
  CONSTRAINT fk_feedback_project FOREIGN KEY (project_id) REFERENCES fyp_projects(project_id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_submission FOREIGN KEY (submission_id) REFERENCES projects_submissions(submission_id) ON DELETE SET NULL,
  CONSTRAINT fk_feedback_author FOREIGN KEY (author_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_assessment_settings (
  setting_id INT NOT NULL PRIMARY KEY DEFAULT 1,
  supervisor_weight DECIMAL(5,2) NULL,
  examiner_weight DECIMAL(5,2) NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_assessment_setting_user FOREIGN KEY (updated_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO fyp_assessment_settings (setting_id, supervisor_weight, examiner_weight)
VALUES (1, NULL, NULL);

CREATE TABLE IF NOT EXISTS fyp_rubric_items (
  rubric_item_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  criterion VARCHAR(255) NOT NULL,
  description TEXT NULL,
  max_score DECIMAL(6,2) NOT NULL,
  weightage DECIMAL(6,2) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_evaluations (
  evaluation_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  examiner_user_id INT NOT NULL,
  strengths TEXT NULL,
  improvements TEXT NULL,
  recommendations TEXT NULL,
  overall_comments TEXT NULL,
  total_score DECIMAL(8,2) NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  status ENUM('Draft','Submitted') NOT NULL DEFAULT 'Draft',
  submitted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_evaluation_project_examiner (project_id, examiner_user_id),
  CONSTRAINT fk_evaluation_project FOREIGN KEY (project_id) REFERENCES fyp_projects(project_id) ON DELETE CASCADE,
  CONSTRAINT fk_evaluation_examiner FOREIGN KEY (examiner_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_supervisor_assessments (
  assessment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  supervisor_user_id INT NOT NULL,
  comments TEXT NULL,
  total_score DECIMAL(8,2) NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  status ENUM('Draft','Submitted') NOT NULL DEFAULT 'Draft',
  submitted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_supervisor_assessment (project_id, supervisor_user_id),
  CONSTRAINT fk_sv_assessment_project FOREIGN KEY (project_id) REFERENCES fyp_projects(project_id) ON DELETE CASCADE,
  CONSTRAINT fk_sv_assessment_supervisor FOREIGN KEY (supervisor_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_supervisor_assessment_scores (
  score_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT NOT NULL,
  rubric_item_id INT NOT NULL,
  score DECIMAL(6,2) NOT NULL,
  comment TEXT NULL,
  UNIQUE KEY uq_sv_assessment_rubric (assessment_id, rubric_item_id),
  CONSTRAINT fk_sv_score_assessment FOREIGN KEY (assessment_id) REFERENCES fyp_supervisor_assessments(assessment_id) ON DELETE CASCADE,
  CONSTRAINT fk_sv_score_rubric FOREIGN KEY (rubric_item_id) REFERENCES fyp_rubric_items(rubric_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fyp_evaluation_scores (
  score_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  evaluation_id INT NOT NULL,
  rubric_item_id INT NOT NULL,
  score DECIMAL(6,2) NOT NULL,
  comment TEXT NULL,
  UNIQUE KEY uq_evaluation_rubric (evaluation_id, rubric_item_id),
  CONSTRAINT fk_score_evaluation FOREIGN KEY (evaluation_id) REFERENCES fyp_evaluations(evaluation_id) ON DELETE CASCADE,
  CONSTRAINT fk_score_rubric FOREIGN KEY (rubric_item_id) REFERENCES fyp_rubric_items(rubric_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Starter rubric only. Replace/edit these criteria to match the official MJIIT rubric.
INSERT INTO fyp_rubric_items (criterion, description, max_score, weightage, display_order)
SELECT 'Technical Quality', 'Quality and correctness of the technical implementation.', 30, NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM fyp_rubric_items);
INSERT INTO fyp_rubric_items (criterion, description, max_score, weightage, display_order)
SELECT 'Innovation', 'Originality and value of the proposed solution.', 20, NULL, 2
WHERE (SELECT COUNT(*) FROM fyp_rubric_items) = 1;
INSERT INTO fyp_rubric_items (criterion, description, max_score, weightage, display_order)
SELECT 'Documentation', 'Clarity, completeness and academic quality of the report.', 20, NULL, 3
WHERE (SELECT COUNT(*) FROM fyp_rubric_items) = 2;
INSERT INTO fyp_rubric_items (criterion, description, max_score, weightage, display_order)
SELECT 'Presentation and Demonstration', 'Communication, demonstration and response to questions.', 20, NULL, 4
WHERE (SELECT COUNT(*) FROM fyp_rubric_items) = 3;
INSERT INTO fyp_rubric_items (criterion, description, max_score, weightage, display_order)
SELECT 'Project Management', 'Planning, progress, testing and professional practice.', 10, NULL, 5
WHERE (SELECT COUNT(*) FROM fyp_rubric_items) = 4;

DROP PROCEDURE IF EXISTS add_column_if_missing;
