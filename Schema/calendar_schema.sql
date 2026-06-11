-- -----------------------------------------------------
-- Mock Data for `ifamous_dbms`.`time_table`
-- Dependencies: Ensure fyp_session table has IDs 25261 and 25262
-- -----------------------------------------------------

USE `ifamous_dbms`;

INSERT INTO `time_table` (`fyp_session_id`, `is_class`, `owner_identifier`, `schedule_json`) VALUES

-- ==========================================
-- SESSION 25261 MOCK DATA
-- ==========================================

-- 1. A typical Class Section (Section 01)
(25261, 1, 'Section 01', '{
  "weekly_recurring": [
    {
      "day_of_week": 1,
      "day_name": "Monday",
      "slots": [
        {
          "start_time": "09:00",
          "end_time": "12:00",
          "label": "Application Development - Lab",
          "is_blocking": true
        }
      ]
    },
    {
      "day_of_week": 3,
      "day_name": "Wednesday",
      "slots": [
        {
          "start_time": "10:00",
          "end_time": "12:00",
          "label": "Application Development - Lecture",
          "is_blocking": true
        }
      ]
    }
  ],
  "specific_events": []
}'),

-- 2. A Staff Member (Dr. Neo) with recurring hours and a specific event
(25261, 0, 'dr.neo@utm.my', '{
  "weekly_recurring": [
    {
      "day_of_week": 2,
      "day_name": "Tuesday",
      "slots": [
        {
          "start_time": "14:00",
          "end_time": "16:00",
          "label": "FYP Consultation Hours",
          "is_blocking": false
        }
      ]
    }
  ],
  "specific_events": [
    {
      "date": "2026-05-10",
      "start_time": "14:00",
      "end_time": "16:00",
      "label": "FYP Proposal Briefing",
      "is_blocking": true
    }
  ]
}'),

-- ==========================================
-- SESSION 25262 MOCK DATA
-- ==========================================

-- 3. Another Class Section (Section 02)
(25262, 1, 'Section 02', '{
  "weekly_recurring": [
    {
      "day_of_week": 4,
      "day_name": "Thursday",
      "slots": [
        {
          "start_time": "08:00",
          "end_time": "11:00",
          "label": "System Architecture - Lab",
          "is_blocking": true
        }
      ]
    }
  ],
  "specific_events": []
}'),

-- 4. Another Staff Member (Prof. Smith) with only specific events
(25262, 0, 'prof.smith@utm.my', '{
  "weekly_recurring": [],
  "specific_events": [
    {
      "date": "2026-11-15",
      "start_time": "09:00",
      "end_time": "12:00",
      "label": "Final Year Project Presentations - Panel A",
      "is_blocking": true
    },
    {
      "date": "2026-11-16",
      "start_time": "09:00",
      "end_time": "12:00",
      "label": "Final Year Project Presentations - Panel B",
      "is_blocking": true
    }
  ]
}');