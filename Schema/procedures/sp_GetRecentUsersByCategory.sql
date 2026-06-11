CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_GetRecentUsersByCategory`()
BEGIN
    -- 1. Students (Limit 20, sorted by latest)
    SELECT u.user_id, u.email, u.full_name, u.phone_number, s.metric_number
    FROM users u
    JOIN students s ON u.user_id = s.student_id
    ORDER BY u.date_created DESC, u.user_id DESC
    LIMIT 20;

    -- 2. Lecturers / Staff (Limit 20, sorted by latest)
    SELECT u.user_id, u.email, u.full_name, u.phone_number, u.expertise
    FROM users u
    WHERE u.is_utm_staff = 1
    ORDER BY u.date_created DESC, u.user_id DESC
    LIMIT 20;

    -- 3. Outsiders / Normal Users (Limit 20, sorted by latest)
    SELECT u.user_id, u.email, u.full_name, u.phone_number, u.co_org_name
    FROM users u
    WHERE u.is_utm_staff = 0 AND u.user_id NOT IN (SELECT student_id FROM students)
    ORDER BY u.date_created DESC, u.user_id DESC
    LIMIT 20;
END