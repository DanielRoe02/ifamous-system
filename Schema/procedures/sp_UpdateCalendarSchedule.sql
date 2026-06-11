CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_UpdateCalendarSchedule`(
    IN p_time_table_id INT,
    IN p_user_id INT,
    IN p_class_id INT,
    IN p_schedule_json JSON
)
BEGIN
    UPDATE time_table 
    SET 
        user_id = p_user_id,
        class_id = p_class_id,
        schedule_json = p_schedule_json
    WHERE 
        time_table_id = p_time_table_id;
        
    SELECT ROW_COUNT() AS affected_rows;
END