CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_CheckClassExists`(
    IN p_fyp_session_id INT,
    IN p_section_name VARCHAR(50)
)
BEGIN
    -- Returns the class_id if this section already exists in this session
    SELECT class_id 
    FROM fyp_classes
    WHERE fyp_session_id = p_fyp_session_id 
      AND section_name = p_section_name;
END