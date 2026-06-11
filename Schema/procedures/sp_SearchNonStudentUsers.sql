CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_SearchNonStudentUsers`(
    IN p_search_query VARCHAR(255),
    IN p_session_id INT
)
BEGIN
    SELECT user_id, email, full_name, is_utm_staff 
    FROM users 
    WHERE (email LIKE p_search_query OR full_name LIKE p_search_query) 
      AND user_id NOT IN (SELECT student_id FROM students)
      AND user_id NOT IN (SELECT user_id FROM time_table WHERE fyp_session_id = p_session_id AND user_id IS NOT NULL)
    LIMIT 10;
END