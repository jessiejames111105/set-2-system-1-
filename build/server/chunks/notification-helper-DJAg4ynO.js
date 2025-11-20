import 'mongodb';

function formatTeacherName(fullName, gender = "unknown") {
  if (!fullName) return "Your teacher";
  let lastName;
  if (fullName.includes(",")) {
    lastName = fullName.split(",")[0].trim();
  } else {
    const nameParts = fullName.trim().split(" ");
    lastName = nameParts[nameParts.length - 1];
  }
  let title = "Teacher";
  if (gender === "female") {
    title = "Ms.";
  } else if (gender === "male") {
    title = "Mr.";
  } else {
    title = "Teacher";
  }
  return `${title} ${lastName}`;
}
async function createGradeVerificationNotification(db, studentId, teacherName, subjectName) {
  try {
    const notificationTitle = `Your grade in ${subjectName} is now available`;
    const notificationMessage = `Your grade in ${subjectName} has been released by ${teacherName}. Check your grade report to see your performance.`;
    const notification = {
      student_id: studentId,
      title: notificationTitle,
      message: notificationMessage,
      type: "grade",
      is_read: false,
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date(),
      created_by: null
      // System-generated notification
    };
    await db.collection("notifications").insertOne(notification);
    console.log(`Grade verification notification created for student: ${studentId}`);
  } catch (error) {
    console.error("Error creating grade verification notification:", error);
  }
}
async function createBulkGradeVerificationNotifications(db, studentIds, teacherName, subjectName) {
  try {
    const notificationTitle = `Your grade in ${subjectName} is now available`;
    const notificationMessage = `Your grade in ${subjectName} has been released by ${teacherName}. Check your grade report to see your performance.`;
    const notifications = studentIds.map((studentId) => ({
      student_id: studentId,
      title: notificationTitle,
      message: notificationMessage,
      type: "grade",
      is_read: false,
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date(),
      created_by: null
      // System-generated notification
    }));
    if (notifications.length > 0) {
      await db.collection("notifications").insertMany(notifications);
      console.log(`Grade verification notifications created for ${notifications.length} students`);
    }
  } catch (error) {
    console.error("Error creating bulk grade verification notifications:", error);
  }
}

export { createBulkGradeVerificationNotifications as a, createGradeVerificationNotification as c, formatTeacherName as f };
//# sourceMappingURL=notification-helper-DJAg4ynO.js.map
