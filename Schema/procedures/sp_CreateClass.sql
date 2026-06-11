CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_CreateClass`(
    IN p_fyp_session_id INT,
    IN p_section_name VARCHAR(50)
)
BEGIN
    -- Inserts the new class
    INSERT INTO fyp_classes (fyp_session_id, section_name) 
    VALUES (p_fyp_session_id, p_section_name);
    
    -- Returns the newly generated class_id
    SELECT LAST_INSERT_ID() AS class_id;
END