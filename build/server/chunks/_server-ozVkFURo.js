import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { v as verifyAuth, g as getUserFromRequest } from './auth-helper-DY2o5dhz.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

async function getCurrentSchoolYear(db) {
  try {
    const setting = await db.collection("admin_settings").findOne({
      setting_key: "current_school_year"
    });
    return setting?.setting_value || "2025-2026";
  } catch (error) {
    console.error("Error fetching current school year:", error);
    return "2025-2026";
  }
}
async function GET({ url, request }) {
  try {
    const authResult = await verifyAuth(request, ["student", "teacher", "adviser", "admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const user = authResult.user;
    const action = url.searchParams.get("action");
    const sectionId = url.searchParams.get("sectionId");
    const dayOfWeek = url.searchParams.get("dayOfWeek");
    const scheduleId = url.searchParams.get("scheduleId");
    const db = await connectToDatabase();
    const schoolYear = url.searchParams.get("schoolYear") || await getCurrentSchoolYear(db);
    switch (action) {
      case "schedule-details":
        const pipeline = [
          {
            $match: {
              ...sectionId && { section_id: new ObjectId(sectionId) },
              school_year: schoolYear,
              ...dayOfWeek && { day_of_week: dayOfWeek }
            }
          },
          {
            $lookup: {
              from: "sections",
              localField: "section_id",
              foreignField: "_id",
              as: "section"
            }
          },
          {
            $lookup: {
              from: "subjects",
              localField: "subject_id",
              foreignField: "_id",
              as: "subject"
            }
          },
          {
            $lookup: {
              from: "activity_types",
              localField: "activity_type_id",
              foreignField: "_id",
              as: "activity_type"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "teacher_id",
              foreignField: "_id",
              as: "teacher"
            }
          },
          {
            $lookup: {
              from: "rooms",
              localField: "section.room_id",
              foreignField: "_id",
              as: "room"
            }
          },
          {
            $project: {
              id: "$_id",
              section_id: 1,
              section_name: { $arrayElemAt: ["$section.name", 0] },
              grade_level: { $arrayElemAt: ["$section.grade_level", 0] },
              day_of_week: 1,
              start_time: 1,
              end_time: 1,
              schedule_type: 1,
              subject_id: 1,
              subject_name: { $arrayElemAt: ["$subject.name", 0] },
              subject_code: { $arrayElemAt: ["$subject.code", 0] },
              activity_type_id: 1,
              activity_type_name: { $arrayElemAt: ["$activity_type.name", 0] },
              activity_type_icon: { $arrayElemAt: ["$activity_type.icon", 0] },
              teacher_id: 1,
              teacher_name: { $arrayElemAt: ["$teacher.full_name", 0] },
              teacher_account_number: { $arrayElemAt: ["$teacher.account_number", 0] },
              room_name: { $arrayElemAt: ["$room.name", 0] },
              school_year: 1,
              created_at: 1,
              updated_at: 1
            }
          }
        ];
        const scheduleDetails = await db.collection("schedules").aggregate(pipeline).toArray();
        return json({ success: true, data: scheduleDetails });
      case "single-schedule":
        if (!scheduleId) {
          return json({ success: false, error: "Schedule ID is required" }, { status: 400 });
        }
        const singleSchedule = await db.collection("schedules").aggregate([
          { $match: { _id: new ObjectId(scheduleId) } },
          {
            $lookup: {
              from: "sections",
              localField: "section_id",
              foreignField: "_id",
              as: "section"
            }
          },
          {
            $lookup: {
              from: "subjects",
              localField: "subject_id",
              foreignField: "_id",
              as: "subject"
            }
          },
          {
            $lookup: {
              from: "activity_types",
              localField: "activity_type_id",
              foreignField: "_id",
              as: "activity_type"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "teacher_id",
              foreignField: "_id",
              as: "teacher"
            }
          },
          {
            $project: {
              id: "$_id",
              section_id: 1,
              section_name: { $arrayElemAt: ["$section.name", 0] },
              grade_level: { $arrayElemAt: ["$section.grade_level", 0] },
              day_of_week: 1,
              start_time: 1,
              end_time: 1,
              schedule_type: 1,
              subject_id: 1,
              subject_name: { $arrayElemAt: ["$subject.name", 0] },
              subject_code: { $arrayElemAt: ["$subject.code", 0] },
              activity_type_id: 1,
              activity_type_name: { $arrayElemAt: ["$activity_type.name", 0] },
              activity_type_icon: { $arrayElemAt: ["$activity_type.icon", 0] },
              teacher_id: 1,
              teacher_name: { $arrayElemAt: ["$teacher.full_name", 0] },
              teacher_account_number: { $arrayElemAt: ["$teacher.account_number", 0] },
              school_year: 1,
              created_at: 1,
              updated_at: 1
            }
          }
        ]).toArray();
        if (singleSchedule.length === 0) {
          return json({ success: false, error: "Schedule not found" }, { status: 404 });
        }
        return json({ success: true, data: singleSchedule[0] });
      case "section-schedules":
        if (!sectionId) {
          return json({ success: false, error: "Section ID is required" }, { status: 400 });
        }
        const sectionSchedules = await db.collection("schedules").aggregate([
          {
            $match: {
              section_id: new ObjectId(sectionId),
              school_year: schoolYear
            }
          },
          {
            $lookup: {
              from: "sections",
              localField: "section_id",
              foreignField: "_id",
              as: "section"
            }
          },
          {
            $lookup: {
              from: "subjects",
              localField: "subject_id",
              foreignField: "_id",
              as: "subject"
            }
          },
          {
            $lookup: {
              from: "activity_types",
              localField: "activity_type_id",
              foreignField: "_id",
              as: "activity_type"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "teacher_id",
              foreignField: "_id",
              as: "teacher"
            }
          },
          {
            $lookup: {
              from: "rooms",
              localField: "section.room_id",
              foreignField: "_id",
              as: "room"
            }
          },
          {
            $project: {
              id: "$_id",
              section_id: 1,
              section_name: { $arrayElemAt: ["$section.name", 0] },
              grade_level: { $arrayElemAt: ["$section.grade_level", 0] },
              day_of_week: 1,
              start_time: 1,
              end_time: 1,
              schedule_type: 1,
              subject_id: 1,
              subject_name: { $arrayElemAt: ["$subject.name", 0] },
              subject_code: { $arrayElemAt: ["$subject.code", 0] },
              activity_type_id: 1,
              activity_type_name: { $arrayElemAt: ["$activity_type.name", 0] },
              activity_type_icon: { $arrayElemAt: ["$activity_type.icon", 0] },
              teacher_id: 1,
              teacher_name: { $arrayElemAt: ["$teacher.full_name", 0] },
              teacher_account_number: { $arrayElemAt: ["$teacher.account_number", 0] },
              room_name: { $arrayElemAt: ["$room.name", 0] },
              school_year: 1,
              created_at: 1,
              updated_at: 1
            }
          }
        ]).toArray();
        return json({ success: true, data: sectionSchedules });
      case "teacher-schedules":
        const teacherId = url.searchParams.get("teacherId");
        if (!teacherId) {
          return json({ success: false, error: "Teacher ID is required" }, { status: 400 });
        }
        const teacherSchedules = await db.collection("schedules").aggregate([
          {
            $match: {
              teacher_id: new ObjectId(teacherId),
              school_year: schoolYear
            }
          },
          {
            $lookup: {
              from: "sections",
              localField: "section_id",
              foreignField: "_id",
              as: "section"
            }
          },
          {
            $lookup: {
              from: "subjects",
              localField: "subject_id",
              foreignField: "_id",
              as: "subject"
            }
          },
          {
            $lookup: {
              from: "activity_types",
              localField: "activity_type_id",
              foreignField: "_id",
              as: "activity_type"
            }
          },
          {
            $lookup: {
              from: "rooms",
              localField: "section.room_id",
              foreignField: "_id",
              as: "room"
            }
          },
          {
            $project: {
              id: "$_id",
              section_id: 1,
              section_name: { $arrayElemAt: ["$section.name", 0] },
              grade_level: { $arrayElemAt: ["$section.grade_level", 0] },
              day_of_week: 1,
              start_time: 1,
              end_time: 1,
              schedule_type: 1,
              subject_id: 1,
              subject_name: { $arrayElemAt: ["$subject.name", 0] },
              subject_code: { $arrayElemAt: ["$subject.code", 0] },
              activity_type_id: 1,
              activity_type_name: { $arrayElemAt: ["$activity_type.name", 0] },
              room_name: { $arrayElemAt: ["$room.name", 0] },
              school_year: 1
            }
          },
          {
            $sort: {
              day_of_week: 1,
              start_time: 1
            }
          }
        ]).toArray();
        return json({ success: true, data: teacherSchedules });
      case "student-schedules":
        const studentId = url.searchParams.get("studentId");
        if (!studentId) {
          return json({ success: false, error: "Student ID is required" }, { status: 400 });
        }
        if (user.account_type === "student" && user.id !== studentId) {
          return json({ success: false, error: "Forbidden: You can only view your own schedule" }, { status: 403 });
        }
        const studentSchedules = await db.collection("schedules").aggregate([
          {
            $lookup: {
              from: "section_students",
              localField: "section_id",
              foreignField: "section_id",
              as: "section_student"
            }
          },
          {
            $match: {
              "section_student.student_id": new ObjectId(studentId),
              "section_student.status": "active",
              school_year: schoolYear
            }
          },
          {
            $lookup: {
              from: "sections",
              localField: "section_id",
              foreignField: "_id",
              as: "section"
            }
          },
          {
            $lookup: {
              from: "subjects",
              localField: "subject_id",
              foreignField: "_id",
              as: "subject"
            }
          },
          {
            $lookup: {
              from: "activity_types",
              localField: "activity_type_id",
              foreignField: "_id",
              as: "activity_type"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "teacher_id",
              foreignField: "_id",
              as: "teacher"
            }
          },
          {
            $lookup: {
              from: "rooms",
              localField: "section.room_id",
              foreignField: "_id",
              as: "room"
            }
          },
          {
            $project: {
              id: "$_id",
              section_id: 1,
              section_name: { $arrayElemAt: ["$section.name", 0] },
              grade_level: { $arrayElemAt: ["$section.grade_level", 0] },
              day_of_week: 1,
              start_time: 1,
              end_time: 1,
              schedule_type: 1,
              subject_id: 1,
              subject_name: { $arrayElemAt: ["$subject.name", 0] },
              subject_code: { $arrayElemAt: ["$subject.code", 0] },
              activity_type_id: 1,
              activity_type_name: { $arrayElemAt: ["$activity_type.name", 0] },
              activity_type_icon: { $arrayElemAt: ["$activity_type.icon", 0] },
              teacher_id: 1,
              teacher_name: { $arrayElemAt: ["$teacher.full_name", 0] },
              room_name: { $arrayElemAt: ["$room.name", 0] },
              school_year: 1
            }
          },
          {
            $addFields: {
              day_order: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$day_of_week", "monday"] }, then: 1 },
                    { case: { $eq: ["$day_of_week", "tuesday"] }, then: 2 },
                    { case: { $eq: ["$day_of_week", "wednesday"] }, then: 3 },
                    { case: { $eq: ["$day_of_week", "thursday"] }, then: 4 },
                    { case: { $eq: ["$day_of_week", "friday"] }, then: 5 },
                    { case: { $eq: ["$day_of_week", "saturday"] }, then: 6 },
                    { case: { $eq: ["$day_of_week", "sunday"] }, then: 7 }
                  ],
                  default: 8
                }
              }
            }
          },
          {
            $sort: {
              day_order: 1,
              start_time: 1
            }
          }
        ]).toArray();
        return json({ success: true, data: studentSchedules });
      case "check-conflicts":
        const checkSectionId = url.searchParams.get("sectionId");
        const checkDayOfWeek = url.searchParams.get("dayOfWeek");
        const checkStartTime = url.searchParams.get("startTime");
        const checkEndTime = url.searchParams.get("endTime");
        const checkTeacherId = url.searchParams.get("teacherId");
        const checkSchoolYear = url.searchParams.get("schoolYear") || await getCurrentSchoolYear(db);
        if (!checkSectionId || !checkDayOfWeek || !checkStartTime || !checkEndTime) {
          return json({ success: false, error: "Missing required parameters for conflict check" }, { status: 400 });
        }
        const conflicts = [];
        const sectionConflictQuery = {
          section_id: new ObjectId(checkSectionId),
          day_of_week: checkDayOfWeek,
          school_year: checkSchoolYear,
          $or: [
            {
              $and: [
                { start_time: { $lte: checkStartTime } },
                { end_time: { $gt: checkStartTime } }
              ]
            },
            {
              $and: [
                { start_time: { $lt: checkEndTime } },
                { end_time: { $gte: checkEndTime } }
              ]
            },
            {
              $and: [
                { start_time: { $gte: checkStartTime } },
                { end_time: { $lte: checkEndTime } }
              ]
            }
          ]
        };
        const sectionConflict = await db.collection("schedules").aggregate([
          { $match: sectionConflictQuery },
          {
            $lookup: {
              from: "sections",
              localField: "section_id",
              foreignField: "_id",
              as: "section"
            }
          },
          {
            $lookup: {
              from: "subjects",
              localField: "subject_id",
              foreignField: "_id",
              as: "subject"
            }
          },
          {
            $lookup: {
              from: "activity_types",
              localField: "activity_type_id",
              foreignField: "_id",
              as: "activity_type"
            }
          },
          {
            $project: {
              id: "$_id",
              start_time: 1,
              end_time: 1,
              section_name: { $arrayElemAt: ["$section.name", 0] },
              grade_level: { $arrayElemAt: ["$section.grade_level", 0] },
              subject_name: { $arrayElemAt: ["$subject.name", 0] },
              activity_name: { $arrayElemAt: ["$activity_type.name", 0] }
            }
          }
        ]).toArray();
        if (sectionConflict.length > 0) {
          const conflict = sectionConflict[0];
          const conflictName = conflict.subject_name || conflict.activity_name || "Schedule";
          conflicts.push({
            type: "section_conflict",
            message: `Time conflict detected: ${conflictName} is already scheduled for ${conflict.section_name} (Grade ${conflict.grade_level}) from ${conflict.start_time} to ${conflict.end_time} on ${checkDayOfWeek}`,
            details: conflict
          });
        }
        if (checkTeacherId) {
          const teacherConflictQuery = {
            teacher_id: new ObjectId(checkTeacherId),
            day_of_week: checkDayOfWeek,
            school_year: checkSchoolYear,
            section_id: { $ne: new ObjectId(checkSectionId) },
            $or: [
              {
                $and: [
                  { start_time: { $lte: checkStartTime } },
                  { end_time: { $gt: checkStartTime } }
                ]
              },
              {
                $and: [
                  { start_time: { $lt: checkEndTime } },
                  { end_time: { $gte: checkEndTime } }
                ]
              },
              {
                $and: [
                  { start_time: { $gte: checkStartTime } },
                  { end_time: { $lte: checkEndTime } }
                ]
              }
            ]
          };
          const teacherConflict = await db.collection("schedules").aggregate([
            { $match: teacherConflictQuery },
            {
              $lookup: {
                from: "sections",
                localField: "section_id",
                foreignField: "_id",
                as: "section"
              }
            },
            {
              $lookup: {
                from: "users",
                localField: "teacher_id",
                foreignField: "_id",
                as: "teacher"
              }
            },
            {
              $lookup: {
                from: "subjects",
                localField: "subject_id",
                foreignField: "_id",
                as: "subject"
              }
            },
            {
              $lookup: {
                from: "activity_types",
                localField: "activity_type_id",
                foreignField: "_id",
                as: "activity_type"
              }
            },
            {
              $project: {
                id: "$_id",
                start_time: 1,
                end_time: 1,
                section_id: 1,
                section_name: { $arrayElemAt: ["$section.name", 0] },
                grade_level: { $arrayElemAt: ["$section.grade_level", 0] },
                teacher_name: { $arrayElemAt: ["$teacher.full_name", 0] },
                subject_name: { $arrayElemAt: ["$subject.name", 0] },
                activity_name: { $arrayElemAt: ["$activity_type.name", 0] }
              }
            }
          ]).toArray();
          if (teacherConflict.length > 0) {
            const conflict = teacherConflict[0];
            const conflictSubject = conflict.subject_name || conflict.activity_name || "a class";
            conflicts.push({
              type: "teacher_conflict",
              message: `Teacher conflict detected: ${conflict.teacher_name} is already scheduled to teach ${conflictSubject} for ${conflict.section_name} (Grade ${conflict.grade_level}) from ${conflict.start_time} to ${conflict.end_time} on ${checkDayOfWeek}`,
              details: conflict
            });
          }
        }
        return json({
          success: true,
          hasConflicts: conflicts.length > 0,
          conflicts
        });
      default:
        const allSchedules = await db.collection("schedules").aggregate([
          {
            $match: {
              ...sectionId && { section_id: new ObjectId(sectionId) },
              school_year: schoolYear,
              ...dayOfWeek && { day_of_week: dayOfWeek }
            }
          },
          {
            $lookup: {
              from: "sections",
              localField: "section_id",
              foreignField: "_id",
              as: "section"
            }
          },
          {
            $lookup: {
              from: "subjects",
              localField: "subject_id",
              foreignField: "_id",
              as: "subject"
            }
          },
          {
            $lookup: {
              from: "activity_types",
              localField: "activity_type_id",
              foreignField: "_id",
              as: "activity_type"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "teacher_id",
              foreignField: "_id",
              as: "teacher"
            }
          },
          {
            $lookup: {
              from: "rooms",
              localField: "section.room_id",
              foreignField: "_id",
              as: "room"
            }
          },
          {
            $project: {
              id: "$_id",
              section_id: 1,
              section_name: { $arrayElemAt: ["$section.name", 0] },
              grade_level: { $arrayElemAt: ["$section.grade_level", 0] },
              day_of_week: 1,
              start_time: 1,
              end_time: 1,
              schedule_type: 1,
              subject_id: 1,
              subject_name: { $arrayElemAt: ["$subject.name", 0] },
              subject_code: { $arrayElemAt: ["$subject.code", 0] },
              activity_type_id: 1,
              activity_type_name: { $arrayElemAt: ["$activity_type.name", 0] },
              activity_type_icon: { $arrayElemAt: ["$activity_type.icon", 0] },
              teacher_id: 1,
              teacher_name: { $arrayElemAt: ["$teacher.full_name", 0] },
              teacher_account_number: { $arrayElemAt: ["$teacher.account_number", 0] },
              room_name: { $arrayElemAt: ["$room.name", 0] },
              school_year: 1,
              created_at: 1,
              updated_at: 1
            }
          }
        ]).toArray();
        return json({ success: true, data: allSchedules });
    }
  } catch (error) {
    console.error("Error fetching schedules data:", error);
    return json({ success: false, error: "Failed to fetch schedules data" }, { status: 500 });
  }
}
async function POST({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["teacher", "adviser", "admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const user = authResult.user;
    const data = await request.json();
    console.log("Received schedule data:", data);
    const {
      sectionId,
      dayOfWeek,
      startTime,
      endTime,
      scheduleType,
      subjectId,
      activityTypeId,
      teacherId,
      schoolYear
    } = data;
    console.log("Received schedule data:", {
      sectionId,
      dayOfWeek,
      startTime,
      endTime,
      scheduleType,
      subjectId,
      activityTypeId,
      teacherId,
      schoolYear
    });
    const clientIP = getClientAddress();
    const userAgent = request.headers.get("user-agent");
    if (!sectionId || !dayOfWeek || !startTime || !endTime || !scheduleType || !schoolYear) {
      return json({ success: false, error: "Missing required fields" }, { status: 400 });
    }
    if (scheduleType === "subject" && !subjectId) {
      return json({ success: false, error: "Subject ID is required for subject schedules" }, { status: 400 });
    }
    if (scheduleType === "activity" && !activityTypeId) {
      return json({ success: false, error: "Activity Type ID is required for activity schedules" }, { status: 400 });
    }
    const db = await connectToDatabase();
    const conflictQuery = {
      section_id: new ObjectId(sectionId),
      day_of_week: dayOfWeek,
      school_year: schoolYear,
      $or: [
        {
          $and: [
            { start_time: { $lte: startTime } },
            { end_time: { $gt: startTime } }
          ]
        },
        {
          $and: [
            { start_time: { $lt: endTime } },
            { end_time: { $gte: endTime } }
          ]
        },
        {
          $and: [
            { start_time: { $gte: startTime } },
            { end_time: { $lte: endTime } }
          ]
        }
      ]
    };
    const conflictingSchedule = await db.collection("schedules").findOne(conflictQuery);
    if (conflictingSchedule) {
      return json({
        success: false,
        error: "Time conflict detected with existing schedule in this section",
        conflictingSchedule: {
          id: conflictingSchedule._id,
          start_time: conflictingSchedule.start_time,
          end_time: conflictingSchedule.end_time
        }
      }, { status: 409 });
    }
    if (teacherId) {
      const teacherConflictQuery = {
        teacher_id: new ObjectId(teacherId),
        day_of_week: dayOfWeek,
        school_year: schoolYear,
        section_id: { $ne: new ObjectId(sectionId) },
        $or: [
          {
            $and: [
              { start_time: { $lte: startTime } },
              { end_time: { $gt: startTime } }
            ]
          },
          {
            $and: [
              { start_time: { $lt: endTime } },
              { end_time: { $gte: endTime } }
            ]
          },
          {
            $and: [
              { start_time: { $gte: startTime } },
              { end_time: { $lte: endTime } }
            ]
          }
        ]
      };
      const teacherConflict = await db.collection("schedules").aggregate([
        { $match: teacherConflictQuery },
        {
          $lookup: {
            from: "sections",
            localField: "section_id",
            foreignField: "_id",
            as: "section"
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "teacher_id",
            foreignField: "_id",
            as: "teacher"
          }
        },
        {
          $project: {
            id: "$_id",
            start_time: 1,
            end_time: 1,
            section_id: 1,
            section_name: { $arrayElemAt: ["$section.name", 0] },
            grade_level: { $arrayElemAt: ["$section.grade_level", 0] },
            teacher_name: { $arrayElemAt: ["$teacher.full_name", 0] }
          }
        }
      ]).toArray();
      if (teacherConflict.length > 0) {
        const conflict = teacherConflict[0];
        return json({
          success: false,
          error: `Teacher conflict detected: ${conflict.teacher_name} is already scheduled to teach ${conflict.section_name} (Grade ${conflict.grade_level}) from ${conflict.start_time} to ${conflict.end_time} on ${dayOfWeek}`,
          conflictType: "teacher_conflict",
          conflictingSchedule: conflict
        }, { status: 409 });
      }
    }
    try {
      const scheduleDoc = {
        section_id: new ObjectId(sectionId),
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        schedule_type: scheduleType,
        subject_id: subjectId ? new ObjectId(subjectId) : null,
        activity_type_id: activityTypeId ? new ObjectId(activityTypeId) : null,
        teacher_id: teacherId ? new ObjectId(teacherId) : null,
        school_year: schoolYear,
        created_at: /* @__PURE__ */ new Date(),
        updated_at: /* @__PURE__ */ new Date()
      };
      console.log("About to insert schedule document:", scheduleDoc);
      const result = await db.collection("schedules").insertOne(scheduleDoc);
      const newSchedule = {
        id: result.insertedId,
        section_id: scheduleDoc.section_id,
        day_of_week: scheduleDoc.day_of_week,
        start_time: scheduleDoc.start_time,
        end_time: scheduleDoc.end_time,
        schedule_type: scheduleDoc.schedule_type,
        subject_id: scheduleDoc.subject_id,
        activity_type_id: scheduleDoc.activity_type_id,
        teacher_id: scheduleDoc.teacher_id,
        school_year: scheduleDoc.school_year,
        created_at: scheduleDoc.created_at
      };
      try {
        const user2 = await getUserFromRequest(request);
        console.log("Schedule Creation - User from request:", user2);
        console.log("Schedule Creation - All headers:", Object.fromEntries(request.headers.entries()));
        console.log("Schedule Creation - x-user-info header:", request.headers.get("x-user-info"));
        const ip_address = getClientAddress();
        const user_agent = request.headers.get("user-agent");
        const [section, subject, activityType, teacher] = await Promise.all([
          db.collection("sections").findOne({ _id: scheduleDoc.section_id }, { projection: { name: 1, grade_level: 1 } }),
          scheduleDoc.subject_id ? db.collection("subjects").findOne({ _id: scheduleDoc.subject_id }, { projection: { name: 1, code: 1 } }) : null,
          scheduleDoc.activity_type_id ? db.collection("activity_types").findOne({ _id: scheduleDoc.activity_type_id }, { projection: { name: 1 } }) : null,
          scheduleDoc.teacher_id ? db.collection("users").findOne({ _id: scheduleDoc.teacher_id }, { projection: { full_name: 1, account_number: 1 } }) : null
        ]);
        const activityCollection = db.collection("activity_logs");
        await activityCollection.insertOne({
          activity_type: "schedule_created",
          user_id: user2?.id ? new ObjectId(user2.id) : null,
          user_account_number: user2?.account_number || null,
          activity_data: {
            schedule_id: result.insertedId.toString(),
            section_name: section?.name || "Unknown Section",
            grade_level: section?.grade_level || null,
            day_of_week: scheduleDoc.day_of_week,
            start_time: scheduleDoc.start_time,
            end_time: scheduleDoc.end_time,
            schedule_type: scheduleDoc.schedule_type,
            subject_name: subject?.name || null,
            subject_code: subject?.code || null,
            activity_type_name: activityType?.name || null,
            teacher_name: teacher?.full_name || null,
            teacher_account_number: teacher?.account_number || null,
            school_year: scheduleDoc.school_year
          },
          ip_address,
          user_agent,
          created_at: /* @__PURE__ */ new Date()
        });
      } catch (logError) {
        console.error("Error logging activity:", logError);
      }
      return json({
        success: true,
        message: "Schedule created successfully",
        data: newSchedule
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error creating schedule:", error);
    console.error("Error stack:", error.stack);
    return json({ success: false, error: "Failed to create schedule", details: error.message }, { status: 500 });
  }
}
async function PUT({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["teacher", "adviser", "admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const user = authResult.user;
    const data = await request.json();
    const {
      scheduleId,
      sectionId,
      dayOfWeek,
      startTime,
      endTime,
      scheduleType,
      subjectId,
      activityTypeId,
      teacherId,
      schoolYear
    } = data;
    const clientIP = getClientAddress();
    const userAgent = request.headers.get("user-agent");
    if (!scheduleId || !sectionId || !dayOfWeek || !startTime || !endTime || !scheduleType || !schoolYear) {
      return json({ success: false, error: "Missing required fields" }, { status: 400 });
    }
    if (scheduleType === "subject" && !subjectId) {
      return json({ success: false, error: "Subject ID is required for subject schedules" }, { status: 400 });
    }
    if (scheduleType === "activity" && !activityTypeId) {
      return json({ success: false, error: "Activity Type ID is required for activity schedules" }, { status: 400 });
    }
    const db = await connectToDatabase();
    const existingSchedule = await db.collection("schedules").findOne({ _id: new ObjectId(scheduleId) });
    if (!existingSchedule) {
      return json({ success: false, error: "Schedule not found" }, { status: 404 });
    }
    const conflictQuery = {
      _id: { $ne: new ObjectId(scheduleId) },
      section_id: new ObjectId(sectionId),
      day_of_week: dayOfWeek,
      school_year: schoolYear,
      $or: [
        {
          $and: [
            { start_time: { $lte: startTime } },
            { end_time: { $gt: startTime } }
          ]
        },
        {
          $and: [
            { start_time: { $lt: endTime } },
            { end_time: { $gte: endTime } }
          ]
        },
        {
          $and: [
            { start_time: { $gte: startTime } },
            { end_time: { $lte: endTime } }
          ]
        }
      ]
    };
    const conflictingSchedule = await db.collection("schedules").findOne(conflictQuery);
    if (conflictingSchedule) {
      return json({
        success: false,
        error: "Time conflict detected with existing schedule in this section",
        conflictingSchedule: {
          id: conflictingSchedule._id,
          start_time: conflictingSchedule.start_time,
          end_time: conflictingSchedule.end_time
        }
      }, { status: 409 });
    }
    if (teacherId) {
      const teacherConflictQuery = {
        _id: { $ne: new ObjectId(scheduleId) },
        teacher_id: new ObjectId(teacherId),
        day_of_week: dayOfWeek,
        school_year: schoolYear,
        section_id: { $ne: new ObjectId(sectionId) },
        $or: [
          {
            $and: [
              { start_time: { $lte: startTime } },
              { end_time: { $gt: startTime } }
            ]
          },
          {
            $and: [
              { start_time: { $lt: endTime } },
              { end_time: { $gte: endTime } }
            ]
          },
          {
            $and: [
              { start_time: { $gte: startTime } },
              { end_time: { $lte: endTime } }
            ]
          }
        ]
      };
      const teacherConflict = await db.collection("schedules").aggregate([
        { $match: teacherConflictQuery },
        {
          $lookup: {
            from: "sections",
            localField: "section_id",
            foreignField: "_id",
            as: "section"
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "teacher_id",
            foreignField: "_id",
            as: "teacher"
          }
        },
        {
          $project: {
            id: "$_id",
            start_time: 1,
            end_time: 1,
            section_id: 1,
            section_name: { $arrayElemAt: ["$section.name", 0] },
            grade_level: { $arrayElemAt: ["$section.grade_level", 0] },
            teacher_name: { $arrayElemAt: ["$teacher.full_name", 0] }
          }
        }
      ]).toArray();
      if (teacherConflict.length > 0) {
        const conflict = teacherConflict[0];
        return json({
          success: false,
          error: `Teacher conflict detected: ${conflict.teacher_name} is already scheduled to teach ${conflict.section_name} (Grade ${conflict.grade_level}) from ${conflict.start_time} to ${conflict.end_time} on ${dayOfWeek}`,
          conflictType: "teacher_conflict",
          conflictingSchedule: conflict
        }, { status: 409 });
      }
    }
    const updateData = {
      section_id: new ObjectId(sectionId),
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      schedule_type: scheduleType,
      subject_id: subjectId ? new ObjectId(subjectId) : null,
      activity_type_id: activityTypeId ? new ObjectId(activityTypeId) : null,
      teacher_id: teacherId ? new ObjectId(teacherId) : null,
      school_year: schoolYear,
      updated_at: /* @__PURE__ */ new Date()
    };
    await db.collection("schedules").updateOne(
      { _id: new ObjectId(scheduleId) },
      { $set: updateData }
    );
    try {
      const user2 = await getUserFromRequest(request);
      const [section, subject, activityType, teacher] = await Promise.all([
        db.collection("sections").findOne({ _id: updateData.section_id }, { projection: { name: 1, grade_level: 1 } }),
        updateData.subject_id ? db.collection("subjects").findOne({ _id: updateData.subject_id }, { projection: { name: 1, code: 1 } }) : null,
        updateData.activity_type_id ? db.collection("activity_types").findOne({ _id: updateData.activity_type_id }, { projection: { name: 1 } }) : null,
        updateData.teacher_id ? db.collection("users").findOne({ _id: updateData.teacher_id }, { projection: { full_name: 1, account_number: 1 } }) : null
      ]);
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "schedule_updated",
        user_id: user2?.id ? new ObjectId(user2.id) : null,
        user_account_number: user2?.account_number || null,
        activity_data: {
          schedule_id: scheduleId,
          section_name: section?.name || "Unknown Section",
          grade_level: section?.grade_level || null,
          day_of_week: updateData.day_of_week,
          start_time: updateData.start_time,
          end_time: updateData.end_time,
          schedule_type: updateData.schedule_type,
          subject_name: subject?.name || null,
          subject_code: subject?.code || null,
          activity_type_name: activityType?.name || null,
          teacher_name: teacher?.full_name || null,
          teacher_account_number: teacher?.account_number || null,
          school_year: updateData.school_year
        },
        ip_address: clientIP,
        user_agent: userAgent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging activity:", logError);
    }
    const updatedSchedule = {
      id: scheduleId,
      section_id: updateData.section_id,
      day_of_week: updateData.day_of_week,
      start_time: updateData.start_time,
      end_time: updateData.end_time,
      schedule_type: updateData.schedule_type,
      subject_id: updateData.subject_id,
      activity_type_id: updateData.activity_type_id,
      teacher_id: updateData.teacher_id,
      school_year: updateData.school_year,
      updated_at: updateData.updated_at
    };
    return json({
      success: true,
      message: "Schedule updated successfully",
      data: updatedSchedule
    });
  } catch (error) {
    console.error("Error updating schedule:", error);
    return json({ success: false, error: "Failed to update schedule", details: error.message }, { status: 500 });
  }
}
async function DELETE({ url, request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["teacher", "adviser", "admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const user = authResult.user;
    const scheduleId = url.searchParams.get("id");
    const clientIP = getClientAddress();
    const userAgent = request.headers.get("user-agent");
    if (!scheduleId) {
      return json({ success: false, error: "Schedule ID is required" }, { status: 400 });
    }
    const db = await connectToDatabase();
    const existingSchedule = await db.collection("schedules").findOne({ _id: new ObjectId(scheduleId) });
    if (!existingSchedule) {
      return json({ success: false, error: "Schedule not found" }, { status: 404 });
    }
    try {
      await db.collection("schedules").deleteOne({ _id: new ObjectId(scheduleId) });
      try {
        const user2 = await getUserFromRequest(request);
        const [section, subject, activityType, teacher] = await Promise.all([
          db.collection("sections").findOne({ _id: existingSchedule.section_id }, { projection: { name: 1, grade_level: 1 } }),
          existingSchedule.subject_id ? db.collection("subjects").findOne({ _id: existingSchedule.subject_id }, { projection: { name: 1, code: 1 } }) : null,
          existingSchedule.activity_type_id ? db.collection("activity_types").findOne({ _id: existingSchedule.activity_type_id }, { projection: { name: 1 } }) : null,
          existingSchedule.teacher_id ? db.collection("users").findOne({ _id: existingSchedule.teacher_id }, { projection: { full_name: 1, account_number: 1 } }) : null
        ]);
        const activityCollection = db.collection("activity_logs");
        await activityCollection.insertOne({
          activity_type: "schedule_deleted",
          user_id: user2?.id ? new ObjectId(user2.id) : null,
          user_account_number: user2?.account_number || null,
          activity_data: {
            schedule_id: scheduleId,
            section_name: section?.name || "Unknown Section",
            grade_level: section?.grade_level || null,
            day_of_week: existingSchedule.day_of_week,
            start_time: existingSchedule.start_time,
            end_time: existingSchedule.end_time,
            schedule_type: existingSchedule.schedule_type,
            subject_name: subject?.name || null,
            subject_code: subject?.code || null,
            activity_type_name: activityType?.name || null,
            teacher_name: teacher?.full_name || null,
            teacher_account_number: teacher?.account_number || null
          },
          ip_address: clientIP,
          user_agent: userAgent,
          created_at: /* @__PURE__ */ new Date()
        });
      } catch (logError) {
        console.error("Error logging activity:", logError);
      }
      return json({
        success: true,
        message: "Schedule deleted successfully"
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return json({ success: false, error: "Failed to delete schedule" }, { status: 500 });
  }
}

export { DELETE, GET, POST, PUT };
//# sourceMappingURL=_server-ozVkFURo.js.map
