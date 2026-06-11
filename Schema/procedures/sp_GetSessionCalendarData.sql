CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_GetSessionCalendarData`(IN p_session_id INT)
BEGIN
    -- Result Set 1: Verify the Session Exists
    SELECT fyp_session_id 
    FROM fyp_session 
    WHERE fyp_session_id = p_session_id;
    -- Result Set 2: Get all Timetables (Sections & Staff) for this session
    SELECT 
        t.time_table_id,
        t.user_id,
        u.full_name AS staff_name,    -- Fetches staff name if user_id exists
        u.email AS staff_email,       -- Fetches staff email if user_id exists
        t.class_id,
        c.section_name,               -- Fetches section name if class_id exists
        t.schedule_json
    FROM time_table t
    LEFT JOIN users u ON t.user_id = u.user_id
    LEFT JOIN fyp_classes c ON t.class_id = c.class_id
    WHERE t.fyp_session_id = p_session_id;
   
END