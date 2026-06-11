CREATE 
    ALGORITHM = UNDEFINED 
    DEFINER = `root`@`localhost` 
    SQL SECURITY DEFINER
VIEW `vw_project_scheduling_roster` AS
    SELECT 
        `project`.`project_id` AS `project_id`,
        `project`.`fyp_session_id` AS `fyp_session_id`,
        `project`.`title` AS `project_title`,
        JSON_OBJECT('student_id',
                `project`.`student_id`,
                'full_name',
                `stu_user`.`full_name`,
                'metric_number',
                `s`.`metric_number`,
                'email',
                `stu_user`.`email`) AS `student_details`,
        JSON_OBJECT('supervisor_id',
                `project`.`supervisor_id`,
                'full_name',
                `sv_user`.`full_name`,
                'email',
                `sv_user`.`email`) AS `supervisor_details`,
        COALESCE((SELECT 
                        JSON_ARRAYAGG(JSON_OBJECT('examiner_id',
                                            `ea`.`examiners_id`,
                                            'name',
                                            `ex_user`.`full_name`,
                                            'email',
                                            `ex_user`.`email`))
                    FROM
                        (`examine` `ea`
                        JOIN `users` `ex_user` ON ((`ea`.`examiners_id` = `ex_user`.`user_id`)))
                    WHERE
                        (`ea`.`project_id` = `project`.`project_id`)),
                JSON_ARRAY()) AS `examiners_json`
    FROM
        (((`projects` `project`
        JOIN `students` `s` ON ((`project`.`student_id` = `s`.`student_id`)))
        JOIN `users` `stu_user` ON ((`project`.`student_id` = `stu_user`.`user_id`)))
        JOIN `users` `sv_user` ON ((`project`.`supervisor_id` = `sv_user`.`user_id`)))