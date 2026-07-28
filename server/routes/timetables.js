const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const router = express.Router();

const tempFilePath = path.join(__dirname, "..", "..", "localData", "temp_meeting.json");

// POST create calendar schedule
router.post("/timetables", (req, res) => {
  const { fyp_session_id, user_id, class_id, schedule_json } = req.body;

  if (!fyp_session_id || !schedule_json) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const p_user_id = user_id ? parseInt(user_id) : null;
  const p_class_id = class_id ? parseInt(class_id) : null;

  db.query(
    "CALL sp_CreateCalendarSchedule(?, ?, ?, ?)",
    [fyp_session_id, p_user_id, p_class_id, JSON.stringify(schedule_json)],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to create schedule: " + err.message });

      const newIdRow = results[0] && results[0][0];
      const new_time_table_id = newIdRow ? newIdRow.new_time_table_id : null;

      res.json({ message: "Schedule created successfully", time_table_id: new_time_table_id });
    }
  );
});

// DELETE calendar schedule
router.delete("/timetables/:id", (req, res) => {
  const timeTableId = req.params.id;
  db.query("CALL sp_DeleteCalendarSchedule(?)", [timeTableId], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to delete schedule: " + err.message });
    res.json({ message: "Schedule deleted successfully" });
  });
});

// PUT update calendar schedule
router.put("/timetables/:id", (req, res) => {
  const timeTableId = req.params.id;
  const { user_id, class_id, schedule_json } = req.body;

  if (!schedule_json) {
    return res.status(400).json({ error: "schedule_json is required" });
  }

  const p_user_id = user_id ? parseInt(user_id) : null;
  const p_class_id = class_id ? parseInt(class_id) : null;

  db.query(
    "CALL sp_UpdateCalendarSchedule(?, ?, ?, ?)",
    [timeTableId, p_user_id, p_class_id, JSON.stringify(schedule_json)],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to update schedule: " + err.message });
      res.json({ message: "Schedule updated successfully" });
    }
  );
});

// POST crosscheck timetable data
router.post("/timetable/crosscheck", (req, res) => {
  const { fyp_session_id, class_id, user_ids } = req.body;

  if (!fyp_session_id) {
    return res.status(400).json({ error: "fyp_session_id is required" });
  }

  const queries = [];
  const queryValues = [];

  if (class_id) {
    queries.push(`SELECT class_id, schedule_json FROM time_table WHERE class_id = ? AND fyp_session_id = ?`);
    queryValues.push([class_id, fyp_session_id]);
  }

  if (user_ids && user_ids.length > 0) {
    const placeholders = user_ids.map(() => '?').join(',');
    queries.push(`SELECT user_id, schedule_json FROM time_table WHERE user_id IN (${placeholders}) AND fyp_session_id = ?`);
    queryValues.push([...user_ids, fyp_session_id]);
  }

  if (queries.length === 0) {
    return res.json({ status: "success", data: { occupied_events: [] } });
  }

  const promises = queries.map((q, idx) => {
    return new Promise((resolve, reject) => {
      db.query(q, queryValues[idx], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  });

  Promise.all(promises)
    .then(resultsArray => {
      const aggregatedEvents = [];
      let idCounter = 1;

      const formatDate = (date) => {
        let month = '' + (date.getMonth() + 1);
        let day = '' + date.getDate();
        const year = date.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-');
      };

      resultsArray.forEach(results => {
        results.forEach(row => {
          let schedule = {};
          try {
            schedule = typeof row.schedule_json === 'string' ? JSON.parse(row.schedule_json) : row.schedule_json;
          } catch (e) {
            console.error("Failed to parse schedule_json", e);
            return;
          }

          const isClass = row.class_id != null;
          const ownerLabel = isClass ? `Class ID: ${row.class_id}` : `User ID: ${row.user_id}`;
          const color = isClass ? '#eab308' : '#5C001F';

          if (schedule.specific_events && Array.isArray(schedule.specific_events)) {
            schedule.specific_events.forEach(e => {
              aggregatedEvents.push({
                id: `crosscheck-sp-${idCounter++}`,
                title: e.label || e.title,
                date: e.date || e.target_date,
                start_time: e.start_time || '08:00',
                end_time: e.end_time || '09:00',
                owner: ownerLabel,
                is_class: isClass,
                color: color
              });
            });
          }

          if (schedule.weekly_recurring && Array.isArray(schedule.weekly_recurring)) {
            const startDate = new Date(2026, 0, 1);
            const endDate = new Date(2026, 11, 31);

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
              const jsDay = d.getDay();
              const jsonDayOfWeek = jsDay === 0 ? 7 : jsDay;
              const dateStr = formatDate(d);

              const recurringDay = schedule.weekly_recurring.find(r => r.day_of_week === jsonDayOfWeek);
              if (recurringDay && recurringDay.slots) {
                recurringDay.slots.forEach(slot => {
                  aggregatedEvents.push({
                    id: `crosscheck-rc-${idCounter++}`,
                    title: slot.label,
                    date: dateStr,
                    start_time: slot.start_time,
                    end_time: slot.end_time,
                    owner: ownerLabel,
                    is_class: isClass,
                    color: color
                  });
                });
              }
            }
          }
        });
      });

      res.json({ status: "success", data: { occupied_events: aggregatedEvents } });
    })
    .catch(err => {
      console.error("Crosscheck Query Error:", err);
      res.status(500).json({ error: "Failed to crosscheck timetables: " + err.message });
    });
});

// POST temporary meeting generation
router.post("/timetable/generate-temp", (req, res) => {
  const { project, date, start_time, end_time, duration } = req.body;

  if (!project || !date || !start_time || !end_time) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  const payload = {
    id: Date.now().toString(),
    project_id: project.project_id,
    project_title: project.fyp_title,
    student: project.student,
    supervisor: project.supervisor,
    examiners: project.examiners || [],
    date,
    start_time,
    end_time,
    duration,
    generated_at: new Date().toISOString()
  };

  try {
    let meetings = [];
    if (fs.existsSync(tempFilePath)) {
      const data = fs.readFileSync(tempFilePath, 'utf8');
      if (data) {
        meetings = JSON.parse(data);
        if (!Array.isArray(meetings)) meetings = [meetings];
      }
    }
    meetings.push(payload);
    fs.writeFileSync(tempFilePath, JSON.stringify(meetings, null, 4));
    res.json({ success: true, message: "Temporary schedule saved successfully", data: meetings });
  } catch (err) {
    console.error("Failed to write temporary schedule:", err);
    res.status(500).json({ success: false, error: "Server file write error" });
  }
});

// GET temporary meeting
router.get("/timetable/temp", (req, res) => {
  try {
    if (fs.existsSync(tempFilePath)) {
      const data = fs.readFileSync(tempFilePath, 'utf8');
      if (data) {
        let meetings = JSON.parse(data);
        if (!Array.isArray(meetings)) meetings = [meetings];
        return res.json({ success: true, data: meetings });
      }
    }
    res.json({ success: true, data: [] });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to read temp meeting" });
  }
});

// DELETE temporary meeting
router.delete("/timetable/temp", (req, res) => {
  try {
    const id = req.query.id;
    if (fs.existsSync(tempFilePath)) {
      if (id) {
        let meetings = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
        if (!Array.isArray(meetings)) meetings = [meetings];
        meetings = meetings.filter(m => m.id !== id);
        fs.writeFileSync(tempFilePath, JSON.stringify(meetings, null, 4));
      } else {
        fs.writeFileSync(tempFilePath, JSON.stringify([], null, 4));
      }
    }
    res.json({ success: true, message: "Temp meeting(s) deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to delete temp meeting" });
  }
});

// POST: AI Auto-scheduling for all FYP projects
router.post("/timetable/auto-assign", async (req, res) => {
  let {
    fyp_session_id,
    startDate,
    endDate,
    duration,
    allowedDays,
    avoidWeekend,
    avoidOffWorkingHour,
    workingHourStart,
    workingHourEnd,
    avoidLunchHour,
    lunchHourStart,
    lunchHourEnd
  } = req.body;

  if (!fyp_session_id) {
    try {
      const sessionResult = await new Promise((resolve, reject) => {
        db.query("CALL sp_get_all_session()", (err, results) => {
          if (err) reject(err);
          else resolve(results[0] || []);
        });
      });
      const activeSession = sessionResult.find(s => s.is_active === 1 || s.is_active === true || s.is_active === Buffer.from([1]));
      if (activeSession) {
        fyp_session_id = activeSession.session_id;
      } else {
        return res.status(400).json({ success: false, error: "No active session found and fyp_session_id not specified." });
      }
    } catch (e) {
      console.error("Failed to fetch active session for auto-assign:", e);
      return res.status(500).json({ success: false, error: "Database error resolving active session" });
    }
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, error: "startDate and endDate are required" });
  }

  const projectsFilePath = path.join(__dirname, "..", "..", "localData", "fyp_mock_structure.json");
  let projects = [];
  try {
    if (fs.existsSync(projectsFilePath)) {
      projects = JSON.parse(fs.readFileSync(projectsFilePath, 'utf8'));
    }
  } catch (err) {
    console.error("Failed to read fyp_mock_structure.json:", err);
    return res.status(500).json({ success: false, error: "Server failed to load project mock structure" });
  }

  let timetables = [];
  try {
    timetables = await new Promise((resolve, reject) => {
      db.query(
        "SELECT user_id, class_id, schedule_json FROM time_table WHERE fyp_session_id = ?",
        [fyp_session_id],
        (err, results) => {
          if (err) reject(err);
          else resolve(results || []);
        }
      );
    });
  } catch (err) {
    console.error("Failed to query time tables for auto-assign:", err);
    return res.status(500).json({ success: false, error: "Database query failed for timetables" });
  }

  const userSchedules = {};
  const classSchedules = {};

  timetables.forEach(row => {
    let schedule = {};
    if (row.schedule_json) {
      try {
        schedule = typeof row.schedule_json === 'string'
          ? JSON.parse(row.schedule_json)
          : row.schedule_json;
      } catch (parseErr) {
        console.error(`Failed to parse schedule_json for timetable row:`, parseErr);
      }
    }
    if (row.user_id != null) {
      userSchedules[row.user_id] = schedule;
    }
    if (row.class_id != null) {
      classSchedules[row.class_id] = schedule;
    }
  });

  const isOccupied = (schedule, dateStr, slotStart, slotEnd) => {
    if (!schedule) return false;

    if (schedule.specific_events && Array.isArray(schedule.specific_events)) {
      for (const e of schedule.specific_events) {
        const eDate = e.date || e.target_date;
        if (eDate === dateStr) {
          const eStart = e.start_time || '08:00';
          const eEnd = e.end_time || '09:00';
          if (slotStart < eEnd && slotEnd > eStart) {
            return true;
          }
        }
      }
    }

    if (schedule.weekly_recurring && Array.isArray(schedule.weekly_recurring)) {
      const [y, m, dayNum] = dateStr.split('-').map(Number);
      const jsDay = new Date(Date.UTC(y, m - 1, dayNum)).getUTCDay();
      const jsonDayOfWeek = jsDay === 0 ? 7 : jsDay;
      
      const recurringDay = schedule.weekly_recurring.find(r => r.day_of_week === jsonDayOfWeek);
      if (recurringDay && recurringDay.slots) {
        for (const slot of recurringDay.slots) {
          if (slotStart < slot.end_time && slotEnd > slot.start_time) {
            return true;
          }
        }
      }
    }

    return false;
  };

  const getDatesInRange = (startStr, endStr) => {
    const dates = [];
    const [sYear, sMonth, sDay] = startStr.split('-').map(Number);
    const [eYear, eMonth, eDay] = endStr.split('-').map(Number);
    const start = new Date(Date.UTC(sYear, sMonth - 1, sDay));
    const end = new Date(Date.UTC(eYear, eMonth - 1, eDay));
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      let month = '' + (d.getUTCMonth() + 1);
      let day = '' + d.getUTCDate();
      const year = d.getUTCFullYear();
      if (month.length < 2) month = '0' + month;
      if (day.length < 2) day = '0' + day;
      dates.push([year, month, day].join('-'));
    }
    return dates;
  };

  const dates = getDatesInRange(startDate, endDate);
  const dur = parseInt(duration) || 10;
  const meetings = [];
  const unscheduledProjects = [];

  const addMinutes = (timeStr, mins) => {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMins = h * 60 + m + mins;
    const newH = Math.floor(totalMins / 60).toString().padStart(2, '0');
    const newM = (totalMins % 60).toString().padStart(2, '0');
    return `${newH}:${newM}`;
  };

  const localAssignedSlots = [];

  const isScheduledInRun = (userId, classId, dateStr, slotStart, slotEnd) => {
    for (const mt of localAssignedSlots) {
      if (mt.date === dateStr) {
        const isStudentMatch = classId && mt.student?.class_id === classId;
        const isUserMatch = (userId === mt.student?.user_id || 
                             userId === mt.supervisor?.user_id || 
                             mt.examiners?.some(ex => ex.user_id === userId));
        
        if (isStudentMatch || isUserMatch) {
          if (slotStart < mt.end_time && slotEnd > mt.start_time) {
            return true;
          }
        }
      }
    }
    return false;
  };

  for (const project of projects) {
    let scheduled = false;

    const studentUserId = project.student?.user_id;
    const studentClassId = project.student?.class_id;
    const supervisorUserId = project.supervisor?.user_id;
    const examinerUserIds = (project.examiners || []).map(ex => ex.user_id);

    for (const dateStr of dates) {
      if (scheduled) break;

      const [y, m, dayNum] = dateStr.split('-').map(Number);
      const dayOfWeek = new Date(Date.UTC(y, m - 1, dayNum)).getUTCDay();
      const jsDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

      if (allowedDays && Array.isArray(allowedDays) && allowedDays.length > 0) {
        if (!allowedDays.includes(jsDayOfWeek)) {
          continue;
        }
      }

      if (avoidWeekend) {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          continue;
        }
      }

      let dayStart = '08:00';
      let dayEnd = '17:00';
      if (avoidOffWorkingHour) {
        dayStart = workingHourStart || '08:00';
        dayEnd = workingHourEnd || '17:00';
      }

      let currentSlotStart = dayStart;
      while (currentSlotStart < dayEnd) {
        const currentSlotEnd = addMinutes(currentSlotStart, dur);
        if (currentSlotEnd > dayEnd) break;

        if (avoidLunchHour && lunchHourStart && lunchHourEnd) {
          if (currentSlotStart < lunchHourEnd && currentSlotEnd > lunchHourStart) {
            currentSlotStart = addMinutes(currentSlotStart, 5);
            continue;
          }
        }

        let hasConflict = false;

        if (studentClassId && isOccupied(classSchedules[studentClassId], dateStr, currentSlotStart, currentSlotEnd)) {
          hasConflict = true;
        }
        if (!hasConflict && studentUserId && isOccupied(userSchedules[studentUserId], dateStr, currentSlotStart, currentSlotEnd)) {
          hasConflict = true;
        }

        if (!hasConflict && supervisorUserId && isOccupied(userSchedules[supervisorUserId], dateStr, currentSlotStart, currentSlotEnd)) {
          hasConflict = true;
        }

        if (!hasConflict) {
          for (const exId of examinerUserIds) {
            if (isOccupied(userSchedules[exId], dateStr, currentSlotStart, currentSlotEnd)) {
              hasConflict = true;
              break;
            }
          }
        }

        if (!hasConflict) {
          if (isScheduledInRun(studentUserId, studentClassId, dateStr, currentSlotStart, currentSlotEnd)) {
            hasConflict = true;
          }
          if (!hasConflict && isScheduledInRun(supervisorUserId, null, dateStr, currentSlotStart, currentSlotEnd)) {
            hasConflict = true;
          }
          if (!hasConflict) {
            for (const exId of examinerUserIds) {
              if (isScheduledInRun(exId, null, dateStr, currentSlotStart, currentSlotEnd)) {
                hasConflict = true;
                break;
              }
            }
          }
        }

        if (!hasConflict) {
          const payload = {
            id: (Date.now() + Math.floor(Math.random() * 100000)).toString(),
            project_id: project.project_id,
            project_title: project.fyp_title,
            student: project.student,
            supervisor: project.supervisor,
            examiners: project.examiners || [],
            date: dateStr,
            start_time: currentSlotStart,
            end_time: currentSlotEnd,
            duration: dur,
            generated_at: new Date().toISOString()
          };

          meetings.push(payload);
          localAssignedSlots.push(payload);
          scheduled = true;
          break;
        }

        currentSlotStart = currentSlotEnd;
      }
    }

    if (!scheduled) {
      unscheduledProjects.push(project);
    }
  }

  try {
    fs.writeFileSync(tempFilePath, JSON.stringify(meetings, null, 4));
    res.json({
      success: true,
      message: "AI scheduling complete",
      data: meetings,
      totalProjects: projects.length,
      unscheduledProjects
    });
  } catch (err) {
    console.error("Failed to save auto-assigned meetings:", err);
    res.status(500).json({ success: false, error: "Failed to write temp meeting file" });
  }
});

module.exports = router;
