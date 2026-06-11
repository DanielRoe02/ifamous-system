CREATE DATABASE  IF NOT EXISTS `ifamous_dbms` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `ifamous_dbms`;
-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: ifamous_dbms
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `coordinator`
--

DROP TABLE IF EXISTS `coordinator`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coordinator` (
  `user_id` int NOT NULL,
  KEY `user_id` (`user_id`),
  CONSTRAINT `coordinator_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `examine`
--

DROP TABLE IF EXISTS `examine`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `examine` (
  `examiners_id` int NOT NULL,
  `project_id` int NOT NULL,
  KEY `examiners_id` (`examiners_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `examine_ibfk_1` FOREIGN KEY (`examiners_id`) REFERENCES `examiners` (`examiners_id`),
  CONSTRAINT `examine_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `examiners`
--

DROP TABLE IF EXISTS `examiners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `examiners` (
  `industry_background` varchar(255) NOT NULL,
  `examiners_id` int NOT NULL,
  PRIMARY KEY (`examiners_id`),
  CONSTRAINT `examiners_ibfk_1` FOREIGN KEY (`examiners_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fyp_classes`
--

DROP TABLE IF EXISTS `fyp_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fyp_classes` (
  `class_id` int NOT NULL AUTO_INCREMENT,
  `fyp_session_id` int NOT NULL,
  `section_name` varchar(50) NOT NULL,
  PRIMARY KEY (`class_id`),
  UNIQUE KEY `unique_session_class` (`fyp_session_id`,`section_name`),
  CONSTRAINT `fk_class_session` FOREIGN KEY (`fyp_session_id`) REFERENCES `fyp_session` (`fyp_session_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fyp_session`
--

DROP TABLE IF EXISTS `fyp_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fyp_session` (
  `fyp_session_id` int NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`fyp_session_id`),
  UNIQUE KEY `fyp_session_id` (`fyp_session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `grading_table`
--

DROP TABLE IF EXISTS `grading_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grading_table` (
  `grading_id` int NOT NULL AUTO_INCREMENT,
  `grading_data` json NOT NULL,
  `total_score` float NOT NULL,
  `comments` varchar(255) NOT NULL,
  `project_id` int NOT NULL,
  `grader_id` int NOT NULL,
  PRIMARY KEY (`grading_id`),
  KEY `grader_id` (`grader_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `grading_table_ibfk_1` FOREIGN KEY (`grader_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `grading_table_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `meeting`
--

DROP TABLE IF EXISTS `meeting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meeting` (
  `meeting_id` int NOT NULL AUTO_INCREMENT,
  `mom` varchar(255) DEFAULT NULL,
  `meeting_date` date NOT NULL,
  `project_id` int NOT NULL,
  PRIMARY KEY (`meeting_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `meeting_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `meeting_schedule`
--

DROP TABLE IF EXISTS `meeting_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `meeting_schedule` (
  `meeting_id` int NOT NULL AUTO_INCREMENT,
  `meeting_json` json NOT NULL,
  `project_id` int NOT NULL,
  PRIMARY KEY (`meeting_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `meeting_schedule_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `project_id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` varchar(255) NOT NULL,
  `status` varchar(50) NOT NULL,
  `github_link` varchar(255) DEFAULT NULL,
  `drive_link` varchar(255) DEFAULT NULL,
  `parent_project_id` int DEFAULT NULL,
  `supervisor_id` int NOT NULL,
  `student_id` int NOT NULL,
  `fyp_session_id` int NOT NULL,
  PRIMARY KEY (`project_id`),
  KEY `parent_project_id` (`parent_project_id`),
  KEY `supervisor_id` (`supervisor_id`),
  KEY `student_id` (`student_id`),
  KEY `fyp_session_id` (`fyp_session_id`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`parent_project_id`) REFERENCES `projects` (`project_id`),
  CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`supervisor_id`) REFERENCES `supervisor` (`supervisor_id`),
  CONSTRAINT `projects_ibfk_3` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `projects_ibfk_4` FOREIGN KEY (`fyp_session_id`) REFERENCES `fyp_session` (`fyp_session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_submissions`
--

DROP TABLE IF EXISTS `projects_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_submissions` (
  `submission_id` int NOT NULL AUTO_INCREMENT,
  `submission_title` varchar(255) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `submitted_at` date NOT NULL,
  `submission_type` enum('proposal','administrative','presentation','progress_report','final_deliverable','logbook') NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT (_utf8mb4'pending'),
  `project_id` int NOT NULL,
  PRIMARY KEY (`submission_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `projects_submissions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `metric_number` varchar(20) NOT NULL,
  `class_id` int DEFAULT NULL,
  `student_id` int NOT NULL,
  `CGPA` float NOT NULL,
  `GPA` float DEFAULT NULL,
  `proof_of_credit_hours` varchar(255) NOT NULL,
  `credit_hours_completed` float NOT NULL DEFAULT '0',
  PRIMARY KEY (`student_id`),
  UNIQUE KEY `student_id` (`student_id`),
  UNIQUE KEY `metric_number` (`metric_number`),
  KEY `fk_student_class` (`class_id`),
  CONSTRAINT `fk_student_class` FOREIGN KEY (`class_id`) REFERENCES `fyp_classes` (`class_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `students_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `supervisor`
--

DROP TABLE IF EXISTS `supervisor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supervisor` (
  `research_expertise` varchar(255) NOT NULL,
  `sv_capacity` int NOT NULL,
  `current_capacity` int NOT NULL,
  `supervisor_id` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`supervisor_id`),
  CONSTRAINT `supervisor_ibfk_1` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `supervisor_nominations`
--

DROP TABLE IF EXISTS `supervisor_nominations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supervisor_nominations` (
  `nomination_id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `supervisor_id` int NOT NULL,
  `preference_order` int NOT NULL,
  PRIMARY KEY (`nomination_id`),
  UNIQUE KEY `student_id` (`student_id`,`supervisor_id`),
  KEY `supervisor_id` (`supervisor_id`),
  CONSTRAINT `supervisor_nominations_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`),
  CONSTRAINT `supervisor_nominations_ibfk_2` FOREIGN KEY (`supervisor_id`) REFERENCES `supervisor` (`supervisor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `time_table`
--

DROP TABLE IF EXISTS `time_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `time_table` (
  `time_table_id` int NOT NULL AUTO_INCREMENT,
  `fyp_session_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `class_id` int DEFAULT NULL,
  `schedule_json` json NOT NULL,
  PRIMARY KEY (`time_table_id`),
  UNIQUE KEY `unique_user_schedule` (`fyp_session_id`,`user_id`),
  UNIQUE KEY `unique_class_schedule` (`fyp_session_id`,`class_id`),
  KEY `fk_tt_user` (`user_id`),
  KEY `fk_tt_class` (`class_id`),
  CONSTRAINT `fk_tt_class` FOREIGN KEY (`class_id`) REFERENCES `fyp_classes` (`class_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tt_session` FOREIGN KEY (`fyp_session_id`) REFERENCES `fyp_session` (`fyp_session_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `chk_exclusive_owner` CHECK ((((`user_id` is not null) and (`class_id` is null)) or ((`user_id` is null) and (`class_id` is not null))))
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `email` char(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `phone_number` varchar(12) NOT NULL,
  `date_created` date NOT NULL,
  `last_date_login` date NOT NULL,
  `is_utm_staff` tinyint(1) DEFAULT '0',
  `affiliation` varchar(255) DEFAULT NULL,
  `co_org_name` varchar(255) DEFAULT NULL,
  `expertise` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone_number` (`phone_number`)
) ENGINE=InnoDB AUTO_INCREMENT=4022 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `vw_project_scheduling_roster`
--

DROP TABLE IF EXISTS `vw_project_scheduling_roster`;
/*!50001 DROP VIEW IF EXISTS `vw_project_scheduling_roster`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_project_scheduling_roster` AS SELECT 
 1 AS `project_id`,
 1 AS `fyp_session_id`,
 1 AS `project_title`,
 1 AS `student_details`,
 1 AS `supervisor_details`,
 1 AS `examiners_json`*/;
SET character_set_client = @saved_cs_client;

--
-- Dumping events for database 'ifamous_dbms'
--

--
-- Dumping routines for database 'ifamous_dbms'
--
/*!50003 DROP PROCEDURE IF EXISTS `sp_CheckClassExists` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_CreateCalendarSchedule` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_CreateCalendarSchedule`(
    IN p_fyp_session_id INT,
    IN p_user_id INT,
    IN p_class_id INT,
    IN p_schedule_json JSON
)
BEGIN
    DECLARE v_session_exists INT DEFAULT 0;
    SELECT 1 INTO v_session_exists 
    FROM fyp_session 
    WHERE fyp_session_id = p_fyp_session_id LIMIT 1;

    IF v_session_exists = 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Validation Error: The specified FYP Session does not exist.';
    ELSE
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
        SELECT LAST_INSERT_ID() AS new_time_table_id;
    END IF;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_CreateClass` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_DeleteCalendarSchedule` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_DeleteCalendarSchedule`(
    IN p_time_table_id INT
)
BEGIN
    -- Deletes the specific schedule record
    DELETE FROM time_table 
    WHERE time_table_id = p_time_table_id;
    
    -- Return the number of affected rows to confirm success to the backend
    SELECT ROW_COUNT() AS affected_rows;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_delete_session` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_delete_session`(
	IN session_id INT
)
BEGIN
	DELETE FROM fyp_session WHERE  fyp_session_id = session_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_GetRecentUsersByCategory` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_GetSessionCalendarData` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_GetSessionCalendarData`(IN p_session_id INT)
BEGIN
    SELECT fyp_session_id 
    FROM fyp_session 
    WHERE fyp_session_id = p_session_id;

    SELECT 
        tt.time_table_id,
        tt.user_id,
        u.full_name AS staff_name,
        u.email AS staff_email,
        tt.class_id,
        c.section_name,
        tt.schedule_json
    FROM time_table tt
    LEFT JOIN users u ON tt.user_id = u.user_id
    LEFT JOIN fyp_classes c ON tt.class_id = c.class_id
    WHERE tt.fyp_session_id = p_session_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_get_all_session` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_get_all_session`()
BEGIN
	SELECT * FROM fyp_session;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_insert_session` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_insert_session`(
IN session_number INT)
BEGIN
	INSERT INTO fyp_session (fyp_session_id) VALUES (session_number);
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_lookup_user_role` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_lookup_user_role`(
	IN email_address VARCHAR(255),
	IN user_id INT
)
BEGIN
	SELECT
		-- Check for presence in sub-tables
		IF(s.student_id IS NOT NULL, 1, 0) AS is_student,
		IF(sv.supervisor_id IS NOT NULL, 1, 0) AS is_supervisor,
		IF(e.examiners_id IS NOT NULL, 1, 0) AS is_examiner,
		IF(c.user_id IS NOT NULL, 1, 0) AS is_coordinator
	FROM users u
	LEFT JOIN students s ON u.user_id = s.student_id
	LEFT JOIN supervisor sv ON u.user_id = sv.supervisor_id
	LEFT JOIN examiners e ON u.user_id = e.examiners_id
	LEFT JOIN coordinator c ON u.user_id = c.user_id
	WHERE u.email = email_address AND u.user_id = user_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_SearchNonStudentUsers` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_SearchNonStudentUsers`(
    IN p_search_query VARCHAR(255),
    IN p_session_id INT
)
BEGIN
    SELECT user_id, email, full_name, is_utm_staff 
    FROM users 
    WHERE (email LIKE p_search_query OR full_name LIKE p_search_query) 
      AND user_id NOT IN (SELECT student_id FROM students)
      AND user_id NOT IN (SELECT user_id FROM time_table WHERE fyp_session_id = p_session_id AND user_id IS NOT NULL)
    LIMIT 10;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_select_session` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_select_session`(
	IN session_number int
)
BEGIN
	SELECT fyp_session_id FROM fyp_session WHERE fyp_session_id = session_number;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_SetActiveFYPSession` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_signup_normal_user` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_UpdateCalendarSchedule` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_UpdateUserProfile` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_update_session` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Final view structure for view `vw_project_scheduling_roster`
--

/*!50001 DROP VIEW IF EXISTS `vw_project_scheduling_roster`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_project_scheduling_roster` AS select `project`.`project_id` AS `project_id`,`project`.`fyp_session_id` AS `fyp_session_id`,`project`.`title` AS `project_title`,json_object('student_id',`project`.`student_id`,'full_name',`stu_user`.`full_name`,'metric_number',`s`.`metric_number`,'email',`stu_user`.`email`) AS `student_details`,json_object('supervisor_id',`project`.`supervisor_id`,'full_name',`sv_user`.`full_name`,'email',`sv_user`.`email`) AS `supervisor_details`,coalesce((select json_arrayagg(json_object('examiner_id',`ea`.`examiners_id`,'name',`ex_user`.`full_name`,'email',`ex_user`.`email`)) from (`examine` `ea` join `users` `ex_user` on((`ea`.`examiners_id` = `ex_user`.`user_id`))) where (`ea`.`project_id` = `project`.`project_id`)),json_array()) AS `examiners_json` from (((`projects` `project` join `students` `s` on((`project`.`student_id` = `s`.`student_id`))) join `users` `stu_user` on((`project`.`student_id` = `stu_user`.`user_id`))) join `users` `sv_user` on((`project`.`supervisor_id` = `sv_user`.`user_id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-30 17:01:28
