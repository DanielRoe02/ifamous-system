CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_DeleteCalendarSchedule`(
    IN p_time_table_id INT
)
BEGIN
    -- Deletes the specific schedule record
    DELETE FROM time_table 
    WHERE time_table_id = p_time_table_id;
    
    -- Return the number of affected rows to confirm success to the backend
    SELECT ROW_COUNT() AS affected_rows;
END