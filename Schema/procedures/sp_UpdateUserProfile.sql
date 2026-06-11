CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_UpdateUserProfile`(
    IN p_user_id INT,
    IN p_full_name VARCHAR(255),
    IN p_email VARCHAR(255),
    IN p_phone_number VARCHAR(20),
    IN p_expertise VARCHAR(255),
    IN p_affiliation VARCHAR(255)
)
BEGIN
    -- Perform the update on the specific user
    UPDATE users 
    SET 
        full_name = p_full_name,
        email = p_email,
        phone_number = p_phone_number,
        expertise = p_expertise,
        affiliation = p_affiliation
    WHERE 
        user_id = p_user_id;
        
    -- Return the number of affected rows to the backend
    -- 1 = Success, 0 = User ID not found or no data was changed
    SELECT ROW_COUNT() AS affected_rows;
END