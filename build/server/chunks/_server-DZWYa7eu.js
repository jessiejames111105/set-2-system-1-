import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { v as verifyAuth } from './auth-helper-DY2o5dhz.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

async function POST({ request, getClientAddress }) {
  try {
    const { activity_type, user_id, user_account_number, activity_data } = await request.json();
    if (!activity_type) {
      return json({ error: "Activity type is required" }, { status: 400 });
    }
    const ip_address = getClientAddress();
    const user_agent = request.headers.get("user-agent");
    const db = await connectToDatabase();
    const collection = db.collection("activity_logs");
    const activityLog = {
      activity_type,
      user_id: user_id ? new ObjectId(user_id) : null,
      user_account_number: user_account_number || null,
      activity_data: activity_data || {},
      ip_address,
      user_agent,
      created_at: /* @__PURE__ */ new Date()
    };
    const result = await collection.insertOne(activityLog);
    return json({
      success: true,
      log_id: result.insertedId.toString(),
      message: "Activity logged successfully"
    });
  } catch (error) {
    console.error("Error logging activity:", error);
    return json({ error: "Failed to log activity" }, { status: 500 });
  }
}
async function GET({ url, request }) {
  function formatTimeInGet(timeString) {
    if (!timeString) return "";
    try {
      let time;
      if (timeString.includes(":")) {
        const [hours, minutes] = timeString.split(":");
        time = /* @__PURE__ */ new Date();
        time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        time = new Date(timeString);
      }
      return time.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    } catch (error) {
      return timeString;
    }
  }
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const limit = parseInt(url.searchParams.get("limit")) || 10;
    const offset = parseInt(url.searchParams.get("offset")) || 0;
    const activity_type = url.searchParams.get("type");
    const db = await connectToDatabase();
    const activityLogsCollection = db.collection("activity_logs");
    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $match: {
          $or: [
            { "user.account_type": "admin" },
            { user: { $exists: false } },
            // Include login/logout activities for admin users
            {
              $and: [
                {
                  $or: [
                    { activity_type: "user_login" },
                    { activity_type: "user_logout" },
                    { action: "login" },
                    { action: "logout" }
                  ]
                },
                {
                  $or: [
                    { "details.account_type": "admin" },
                    { "activity_data.account_type": "admin" }
                  ]
                }
              ]
            }
          ]
        }
      }
    ];
    if (activity_type) {
      pipeline.push({
        $match: {
          $or: [
            { activity_type },
            { action: activity_type }
          ]
        }
      });
    }
    pipeline.push(
      { $sort: { created_at: -1, timestamp: -1 } },
      { $skip: offset },
      { $limit: limit }
    );
    const result = await activityLogsCollection.aggregate(pipeline).toArray();
    const activities = result.map((row) => {
      let message = "";
      let icon = "info";
      const performedBy = row.user?.full_name || (row.user_account_number && row.user_account_number !== "TEST-001" ? row.user_account_number : null) || (row.account_number && row.account_number !== "TEST-001" ? row.account_number : null) || "System";
      const activityType = row.activity_type || row.action;
      const data = row.activity_data || row.details || {};
      switch (activityType) {
        case "account_created":
          if (data.account_type === "student") {
            message = `New student account created: ${data.full_name} (${data.account_number || row.user_account_number || "N/A"})`;
            icon = "person_add";
          } else if (data.account_type === "teacher") {
            message = `New teacher account created: ${data.full_name} (${data.account_number || row.user_account_number || "N/A"})`;
            icon = "person_add";
          } else {
            message = `New ${data.account_type} account created: ${data.full_name} (${data.account_number || row.user_account_number || "N/A"})`;
            icon = "person_add";
          }
          break;
        case "schedule_assigned":
          message = `Schedule assigned to ${data.section} for ${data.room}`;
          icon = "schedule";
          break;
        case "schedule_created":
          const formattedStartTimeCreated = formatTimeInGet(data.start_time);
          const formattedEndTimeCreated = formatTimeInGet(data.end_time);
          const scheduleTypeCreated = data.schedule_type ? data.schedule_type.charAt(0).toUpperCase() + data.schedule_type.slice(1) : "Class";
          const dayOfWeekCreated = data.day_of_week ? data.day_of_week.charAt(0).toUpperCase() + data.day_of_week.slice(1) : "";
          let sectionInfoCreated = "";
          if (data.section_name) {
            sectionInfoCreated = ` for section ${data.section_name}`;
          }
          message = `Schedule created${sectionInfoCreated} - ${scheduleTypeCreated} on ${dayOfWeekCreated} (${formattedStartTimeCreated} - ${formattedEndTimeCreated})`;
          icon = "add_circle";
          break;
        case "schedule_deleted":
          const formattedStartTime = formatTimeInGet(data.start_time);
          const formattedEndTime = formatTimeInGet(data.end_time);
          const scheduleType = data.schedule_type ? data.schedule_type.charAt(0).toUpperCase() + data.schedule_type.slice(1) : "Class";
          const dayOfWeek = data.day_of_week ? data.day_of_week.charAt(0).toUpperCase() + data.day_of_week.slice(1) : "";
          let sectionInfo = "";
          if (data.section_name) {
            sectionInfo = ` for Section ${data.section_name}`;
          }
          message = `Schedule deleted${sectionInfo} - ${scheduleType} on ${dayOfWeek} (${formattedStartTime} - ${formattedEndTime})`;
          icon = "delete";
          break;
        case "room_created":
          message = `New room created: ${data.room_name} (${data.building}, Floor ${data.floor})`;
          icon = "meeting_room";
          break;
        case "section_created":
          message = `New section created: ${data.section_name} (Grade ${data.grade_level})`;
          icon = "class";
          break;
        case "section_updated":
          message = `Section updated: ${data.section_name}`;
          icon = "edit";
          break;
        case "adviser_assigned_to_section":
          const assignedAdviserName = data.adviser ? `${data.adviser.name} (${data.adviser.account_number})` : "Unknown Adviser";
          message = `Adviser assigned to ${data.section_name} (Grade ${data.grade_level}): ${assignedAdviserName}`;
          icon = "person_add";
          break;
        case "adviser_changed_in_section":
          const oldAdviserChanged = data.old_adviser ? `${data.old_adviser.name} (${data.old_adviser.account_number})` : "No adviser";
          const newAdviserChanged = data.new_adviser ? `${data.new_adviser.name} (${data.new_adviser.account_number})` : "No adviser";
          message = `Adviser changed for ${data.section_name} (Grade ${data.grade_level}): ${oldAdviserChanged} → ${newAdviserChanged}`;
          icon = "swap_horiz";
          break;
        case "adviser_removed_from_section":
          const removedAdviserName = data.adviser ? `${data.adviser.name} (${data.adviser.account_number})` : "Unknown Adviser";
          message = `Adviser removed from ${data.section_name} (Grade ${data.grade_level}): ${removedAdviserName}`;
          icon = "person_remove";
          break;
        case "section_adviser_changed":
          const oldAdviser = data.old_adviser ? `${data.old_adviser.name} (${data.old_adviser.account_number})` : "No adviser";
          const newAdviser = data.new_adviser ? `${data.new_adviser.name} (${data.new_adviser.account_number})` : "No adviser";
          message = `Section adviser changed for ${data.section_name}: ${oldAdviser} → ${newAdviser}`;
          icon = "swap_horiz";
          break;
        case "section_student_added":
        case "student_added_to_section":
        case "student_added":
          message = `Student added to ${data.section_name}: ${data.student ? data.student.name || data.student.full_name : data.full_name || "Unknown Student"} ${data.student ? `(${data.student.account_number})` : data.account_number ? `(${data.account_number})` : ""}`;
          icon = "person_add";
          break;
        case "section_student_removed":
        case "student_removed_from_section":
        case "student_removed":
          message = `Student removed from ${data.section_name}: ${data.student ? data.student.name || data.student.full_name : data.full_name || "Unknown Student"} ${data.student ? `(${data.student.account_number})` : data.account_number ? `(${data.account_number})` : ""}`;
          icon = "person_remove";
          break;
        case "student_enrolled_to_section":
          message = `Student enrolled to ${data.section_name}: ${data.student ? data.student.name || data.student.full_name : data.full_name || "Unknown Student"} ${data.student ? `(${data.student.account_number})` : data.account_number ? `(${data.account_number})` : ""}`;
          icon = "person_add";
          break;
        case "user_login":
        case "login":
          message = `User logged in: ${data.full_name || performedBy}`;
          icon = "login";
          break;
        case "user_logout":
        case "logout":
          message = `User logged out: ${data.full_name || performedBy}`;
          icon = "logout";
          break;
        case "account_updated":
          message = `Account updated: ${data.full_name || performedBy}`;
          icon = "edit";
          break;
        case "account_archived":
        case "student_archived":
        case "archive":
          if (data.account_type === "student") {
            message = `Student archived: ${data.full_name || performedBy} (${data.account_number || "N/A"})`;
          } else if (data.account_type === "teacher") {
            message = `Teacher archived: ${data.full_name || performedBy} (${data.account_number || "N/A"})`;
          } else {
            message = `Account archived: ${data.full_name || performedBy} (${data.account_number || "N/A"})`;
          }
          icon = "archive";
          break;
        case "account_deleted":
          message = `Account deleted: ${data.full_name || performedBy}`;
          icon = "delete";
          break;
        case "subject_created":
          message = `New subject created: ${data.name} (${data.code})`;
          icon = "book";
          break;
        case "subject_updated":
          message = `Subject updated: ${data.name} (${data.code})`;
          icon = "edit";
          break;
        case "account_restored":
        case "student_restored":
        case "restore":
          if (data.account_type === "student") {
            message = `Student restored: ${data.full_name || performedBy} (${data.account_number || "N/A"})`;
          } else if (data.account_type === "teacher") {
            message = `Teacher restored: ${data.full_name || performedBy} (${data.account_number || "N/A"})`;
          } else {
            message = `Account restored: ${data.full_name || performedBy} (${data.account_number || "N/A"})`;
          }
          icon = "restore";
          break;
        case "subject_deleted":
          message = `Subject deleted: ${data.subject_name} (${data.subject_code})`;
          icon = "delete";
          break;
        case "room_updated":
          message = `Updated room: ${data.room_name}`;
          icon = "edit";
          break;
        case "department_created":
          message = `Created department: ${data.department_name} (${data.department_code})`;
          icon = "corporate_fare";
          break;
        case "department_updated":
          message = `Updated department: ${data.department_name} (${data.department_code})`;
          icon = "edit";
          break;
        case "department_deleted":
          message = `Deleted department: ${data.department_name} (${data.department_code})`;
          icon = "delete";
          break;
        case "department_teacher_assigned":
        case "teacher_assigned":
          const assignedTeachers = data.teachers && data.teachers.length > 0 ? data.teachers.map((t) => t.name || t.full_name).join(", ") : data.teacher_names || data.full_name || "teachers";
          message = `Assigned teachers to department "${data.department_name}": ${assignedTeachers}`;
          icon = "person_add";
          break;
        case "activity_type_created":
          message = `Activity type created: ${data.name} (${data.code})`;
          icon = "add";
          break;
        case "activity_type_updated":
          message = `Activity type updated: ${data.name} (${data.code})`;
          icon = "edit";
          break;
        case "activity_type_deleted":
          message = `Activity type deleted: ${data.name} (${data.code})`;
          icon = "delete";
          break;
        case "department_teacher_removed":
        case "teacher_removed":
          const removedTeachers = data.teachers && data.teachers.length > 0 ? data.teachers.map((t) => t.name || t.full_name).join(", ") : data.teacher_names || data.full_name || "teachers";
          message = `Removed teachers from department "${data.department_name}": ${removedTeachers}`;
          icon = "person_remove";
          break;
        case "department_subject_assigned":
        case "subject_assigned":
          const assignedSubjects = data.subjects && data.subjects.length > 0 ? data.subjects.map((s) => s.name).join(", ") : data.subject_names || "subjects";
          message = `Assigned subjects to department "${data.department_name}": ${assignedSubjects}`;
          icon = "book";
          break;
        case "department_subject_removed":
        case "subject_removed":
          const removedSubjects = data.subjects && data.subjects.length > 0 ? data.subjects.map((s) => s.name).join(", ") : data.subject_names || "subjects";
          message = `Removed subjects from department "${data.department_name}": ${removedSubjects}`;
          icon = "book";
          break;
        case "room_deleted":
          message = `Room deleted: ${data.room_name} (${data.building}, Floor ${data.floor})`;
          icon = "delete";
          break;
        case "room_sections_assigned":
        case "section_assigned":
        case "assignment":
          const assignedSectionNames = data.section_names ? Array.isArray(data.section_names) ? data.section_names : [data.section_names] : data.sections ? [data.sections] : ["sections"];
          if (assignedSectionNames.length === 1) {
            message = `Section ${assignedSectionNames[0]} assigned to ${data.room_name}`;
          } else {
            message = `Sections ${assignedSectionNames.join(", ")} assigned to ${data.room_name}`;
          }
          icon = "assignment";
          break;
        case "room_sections_unassigned":
        case "section_unassigned":
        case "assignment_return":
          const unassignedSectionNames = data.unassigned_sections ? data.unassigned_sections.map((s) => s.name) : data.section_names ? Array.isArray(data.section_names) ? data.section_names : [data.section_names] : data.sections ? [data.sections] : ["all sections"];
          if (unassignedSectionNames.length === 1) {
            message = `Section ${unassignedSectionNames[0]} unassigned from ${data.room_name}`;
          } else {
            message = `Sections ${unassignedSectionNames.join(", ")} unassigned from ${data.room_name}`;
          }
          icon = "assignment_return";
          break;
        case "section_deleted":
          message = `Section deleted: ${data.section_name} (Grade ${data.grade_level})`;
          icon = "delete";
          break;
        case "password_changed":
          message = `Password changed: ${data.full_name || performedBy}`;
          icon = "key";
          break;
        case "profile_updated":
          message = `Profile updated: ${data.full_name || performedBy}`;
          icon = "edit";
          break;
        case "document_request_created":
          message = `Document request created: ${data.document_type || "Unknown document"} (${data.request_id || "N/A"})`;
          icon = "description";
          break;
        case "document_request_updated":
          const formatStatus = (status) => {
            if (!status) return "";
            const statusNames = {
              "on_hold": "On Hold",
              "verifying": "Verifying",
              "processing": "Processing",
              "for_pickup": "For Pick Up",
              "released": "Released",
              "rejected": "Rejected",
              "cancelled": "Cancelled"
            };
            return statusNames[status] || status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
          };
          const oldStatus = formatStatus(data.old_status);
          const newStatus = formatStatus(data.new_status);
          let updateMessage = `Document request ${data.request_id || "N/A"}`;
          if (data.document_type) {
            updateMessage += ` (${data.document_type})`;
          }
          if (data.student_name) {
            updateMessage += ` for ${data.student_name}`;
          }
          const changes = [];
          if (data.status_changed && oldStatus && newStatus && oldStatus !== newStatus) {
            changes.push(`Status: ${oldStatus} → ${newStatus}`);
          }
          if (data.payment_amount_changed) {
            const oldAmt = data.old_payment_amount !== null && data.old_payment_amount !== void 0 ? `₱${data.old_payment_amount}` : "Not set";
            const newAmt = data.new_payment_amount !== null && data.new_payment_amount !== void 0 ? `₱${data.new_payment_amount}` : "Not set";
            changes.push(`Payment: ${oldAmt} → ${newAmt}`);
          }
          if (data.payment_status_changed) {
            const oldPayStatus = data.old_payment_status === "paid" ? "Paid" : "Pending";
            const newPayStatus = data.new_payment_status === "paid" ? "Paid" : "Pending";
            changes.push(`Payment status: ${oldPayStatus} → ${newPayStatus}`);
          }
          if (changes.length > 0) {
            updateMessage += ` - ${changes.join(", ")}`;
          } else {
            updateMessage += " - Updated";
          }
          message = updateMessage;
          icon = "update";
          break;
        case "document_request_rejected":
          let rejectMessage = `Document request ${data.request_id || "N/A"} rejected`;
          if (data.document_type) {
            rejectMessage += ` - ${data.document_type}`;
          }
          if (data.student_name) {
            rejectMessage += ` for ${data.student_name}`;
          }
          message = rejectMessage;
          icon = "cancel";
          break;
        case "document_request_cancelled":
          message = `Document request cancelled by student: ${data.request_id || "N/A"}`;
          icon = "block";
          break;
        default:
          const actionText = typeof activityType === "string" ? activityType : "Unknown Action";
          message = `${actionText.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}: ${data.full_name || performedBy || "System"}`;
          icon = "info";
      }
      const activityTime = new Date(row.created_at || row.timestamp);
      activityTime.setTime(activityTime.getTime() + 8 * 60 * 60 * 1e3);
      const timestamp = activityTime.toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/, "$1/$2/$3 - $4:$5");
      return {
        id: row._id.toString(),
        type: activityType,
        message,
        timestamp,
        icon,
        created_at: row.created_at || row.timestamp,
        data,
        user_name: row.user?.full_name,
        user_account_number: row.user_account_number || row.account_number,
        performed_by: performedBy
      };
    });
    return json({
      success: true,
      activities,
      total: result.length,
      limit,
      offset
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}

export { GET, POST };
//# sourceMappingURL=_server-DZWYa7eu.js.map
