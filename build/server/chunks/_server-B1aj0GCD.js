import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import { v as verifyAuth } from './auth-helper-DY2o5dhz.js';
import 'dotenv';

async function getCurrentSchoolYear(db) {
  try {
    const schoolYearSetting = await db.collection("admin_settings").findOne({
      setting_key: "current_school_year"
    });
    return schoolYearSetting?.setting_value || "2025-2026";
  } catch (error) {
    console.error("Error fetching current school year:", error);
    return "2025-2026";
  }
}
async function GET({ url, request }) {
  try {
    const authResult = await verifyAuth(request, ["student", "teacher", "adviser", "admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: 401 });
    }
    const currentUser = authResult.user;
    const db = await connectToDatabase();
    const studentId = url.searchParams.get("studentId");
    const quarter = parseInt(url.searchParams.get("quarter")) || 1;
    const schoolYear = url.searchParams.get("schoolYear") || await getCurrentSchoolYear(db);
    if (!studentId) {
      return json({
        success: false,
        error: "Student ID is required"
      }, { status: 400 });
    }
    if (!ObjectId.isValid(studentId)) {
      return json({
        success: false,
        error: "Invalid student ID format"
      }, { status: 400 });
    }
    if (currentUser.account_type === "student") {
      const requestingStudentSection = await db.collection("section_students").findOne({
        student_id: new ObjectId(currentUser.id),
        status: "active"
      });
      const queriedStudentSection = await db.collection("section_students").findOne({
        student_id: new ObjectId(studentId),
        status: "active"
      });
      if (currentUser.id !== studentId && (!requestingStudentSection || !queriedStudentSection || requestingStudentSection.section_id.toString() !== queriedStudentSection.section_id.toString())) {
        return json({
          success: false,
          error: "Unauthorized: You can only view rankings for your own class"
        }, { status: 403 });
      }
    }
    const studentEnrollment = await db.collection("section_students").findOne({
      student_id: new ObjectId(studentId),
      status: "active"
    });
    if (!studentEnrollment) {
      return json({
        success: false,
        error: "Student not enrolled in any section"
      }, { status: 404 });
    }
    const section = await db.collection("sections").findOne({
      _id: studentEnrollment.section_id,
      status: "active"
    });
    if (!section) {
      return json({
        success: false,
        error: "Section not found"
      }, { status: 404 });
    }
    if (currentUser.account_type === "teacher") {
      const teacherSchedule = await db.collection("schedules").findOne({
        teacher_id: new ObjectId(currentUser.id),
        section_id: section._id,
        schedule_type: "subject"
      });
      if (!teacherSchedule) {
        return json({
          success: false,
          error: "Unauthorized: You can only view rankings for sections you teach"
        }, { status: 403 });
      }
    }
    if (currentUser.account_type === "adviser") {
      if (!section.adviser_id || section.adviser_id.toString() !== currentUser.id) {
        return json({
          success: false,
          error: "Unauthorized: You can only view rankings for your advisory section"
        }, { status: 403 });
      }
    }
    const sectionInfo = {
      section_id: section._id.toString(),
      name: section.name,
      gradeLevel: section.grade_level
    };
    const allStudentsInSection = await db.collection("section_students").find({
      section_id: section._id,
      status: "active"
    }).toArray();
    const gradesCollection = db.collection("grades");
    const usersCollection = db.collection("users");
    const studentAverages = [];
    for (const student of allStudentsInSection) {
      const studentGrades = await gradesCollection.find({
        student_id: student.student_id,
        section_id: section._id,
        school_year: schoolYear,
        quarter,
        "averages.final_grade": { $exists: true, $ne: null },
        verified: true
      }).toArray();
      if (studentGrades.length > 0) {
        const totalGrades = studentGrades.reduce((sum, grade) => {
          return sum + (grade.averages?.final_grade || 0);
        }, 0);
        const average = totalGrades / studentGrades.length;
        const studentInfo = await usersCollection.findOne({
          _id: student.student_id
        });
        if (studentInfo) {
          studentAverages.push({
            studentId: student.student_id.toString(),
            studentNumber: studentInfo.account_number || "N/A",
            name: `${studentInfo.first_name} ${studentInfo.last_name}`,
            average,
            totalSubjects: studentGrades.length
          });
        }
      }
    }
    studentAverages.sort((a, b) => b.average - a.average);
    let currentRank = 1;
    for (let i = 0; i < studentAverages.length; i++) {
      if (i > 0 && studentAverages[i].average < studentAverages[i - 1].average) {
        currentRank = i + 1;
      }
      studentAverages[i].rank = currentRank;
    }
    const myRanking = studentAverages.find((s) => s.studentId === studentId);
    const myRank = myRanking?.rank || 0;
    const myAverage = myRanking?.average || 0;
    const totalStudents = studentAverages.length;
    return json({
      success: true,
      myRank,
      myAverage,
      totalStudents,
      sectionInfo,
      rankings: studentAverages
    });
  } catch (error) {
    console.error("Error fetching class rankings:", error);
    return json({
      success: false,
      error: "Failed to fetch class rankings"
    }, { status: 500 });
  }
}

export { GET };
//# sourceMappingURL=_server-B1aj0GCD.js.map
