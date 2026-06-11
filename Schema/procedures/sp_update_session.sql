CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_update_session`(
	IN old_session_id INT,
    IN new_session_id INT
)
BEGIN
	UPDATE time_table 
    SET 
        user_id = p_user_id,
        class_id = p_class_id,
        schedule_json = p_schedule_json
    WHERE 
        time_table_id = p_time_table_id;
        
    -- Return the number of affected rows to confirm success
    SELECT ROW_COUNT() AS affected_rows;
END