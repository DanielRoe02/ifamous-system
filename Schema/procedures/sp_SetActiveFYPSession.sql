CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_SetActiveFYPSession`(
    IN p_target_session_id INT
)
BEGIN
    -- Updates all rows in the table. 
    -- If the ID matches the target, it becomes 1 (Active). 
    -- If it doesn't match, it becomes 0 (Inactive).
    UPDATE fyp_session 
    SET is_active = IF(fyp_session_id = p_target_session_id, 1, 0);
    
    -- Return the number of rows that were changed so the backend can verify
    SELECT ROW_COUNT() AS affected_rows;
END