CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_CreateCalendarSchedule`(
    IN p_fyp_session_id INT,
    IN p_user_id INT,     -- Pass NULL if this is for a Class Section
    IN p_class_id INT,    -- Pass NULL if this is for a Staff Member
    IN p_schedule_json JSON
)
BEGIN
    DECLARE v_session_exists INT DEFAULT 0;

    -- 1. Check if the session exists in the fyp_session table
    SELECT 1 INTO v_session_exists 
    FROM fyp_session 
    WHERE fyp_session_id = p_fyp_session_id LIMIT 1;

    -- 2. If it does not exist, throw a custom error immediately
    IF v_session_exists = 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Validation Error: The specified FYP Session does not exist.';
    ELSE
        -- 3. If it does exist, proceed with the insert
        INSERT INTO time_table (
            fyp_session_id, 
            user_id, 
            class_id, 
            schedule_json
        ) 
        VALUES (
            p_fyp_session_id, 
            p_user_id, 
            p_class_id, 
            p_schedule_json
        );
        
        -- Return the newly generated ID back to your backend
        SELECT LAST_INSERT_ID() AS new_time_table_id;
    END IF;

END