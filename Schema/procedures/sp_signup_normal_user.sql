CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_signup_normal_user`(
    IN p_email CHAR(255),
    IN p_password_hash VARCHAR(255),
    IN p_full_name VARCHAR(255),
    IN p_phone_number VARCHAR(12),
    IN co_org_name VARCHAR(255),
    IN expertise VARCHAR(255),
    IN p_affiliation VARCHAR(255)
)
BEGIN
    DECLARE v_is_utm_staff TINYINT DEFAULT 0;
    
    -- 1. Check if email or phone number already exists
    IF EXISTS (SELECT 1 FROM `ifamous_dbms`.`users` WHERE `email` = p_email) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Email already registered.';
    ELSEIF EXISTS (SELECT 1 FROM `ifamous_dbms`.`users` WHERE `phone_number` = p_phone_number) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Phone number already registered.';
    ELSE
        -- 2. Automatic Role Identification based on email suffix (UC102 Step 3-5)
        -- If email contains @utm.my, identify as Internal Staff
        IF p_email LIKE '%@utm.my' THEN
            SET v_is_utm_staff = 1;
        END IF;

		START TRANSACTION;
        -- 3. Insert into users table
        INSERT INTO `ifamous_dbms`.`users` (
            `email`, 
            `password_hash`, 
            `full_name`, 
            `phone_number`, 
            `date_created`, 
            `last_date_login`, 
            `is_utm_staff`, 
            `co_org_name`,
            `expertise`,
            `affiliation`
        ) 
        VALUES (
            p_email, 
            p_password_hash, 
            p_full_name, 
            p_phone_number, 
            CURDATE(), 
            CURDATE(), 
            v_is_utm_staff, 
            co_org_name,
            expertise,
            p_affiliation
        );
        COMMIT;
        -- 4. Return the new User ID for the application to use
        SELECT LAST_INSERT_ID() AS new_user_id;
    END IF;
END