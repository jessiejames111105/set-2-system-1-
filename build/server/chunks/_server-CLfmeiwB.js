import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import { f as formatTeacherName, c as createGradeVerificationNotification, a as createBulkGradeVerificationNotifications } from './notification-helper-DJAg4ynO.js';
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
async function GET({ request, url }) {
  try {
    const db = await connectToDatabase();
    const teacherId = url.searchParams.get("teacher_id");
    const schoolYear = url.searchParams.get("school_year") || await getCurrentSchoolYear(db);
    const quarter = parseInt(url.searchParams.get("quarter")) || 1;
    if (!teacherId) {
      return json({ error: "Teacher ID is required" }, { status: 400 });
    }
    if (!ObjectId.isValid(teacherId)) {
      return json({ error: "Invalid teacher ID format" }, { status: 400 });
    }
    const section = await db.collection("sections").findOne({
      adviser_id: new ObjectId(teacherId),
      status: "active"
    });
    if (!section) {
      return json({
        success: true,
        data: {
          advisoryData: null,
          students: [],
          message: "No advisory section assigned"
        }
      });
    }
    const sectionStudents = await db.collection("section_students").find({
      section_id: section._id,
      status: "active"
    }).toArray();
    const studentIds = sectionStudents.map((ss) => ss.student_id);
    const students = await db.collection("users").find({
      _id: { $in: studentIds },
      account_type: "student",
      status: "active"
    }).sort({ full_name: 1 }).toArray();
    let gradesData = [];
    if (studentIds.length > 0) {
      gradesData = await db.collection("grades").find({
        student_id: { $in: studentIds },
        section_id: section._id,
        school_year: schoolYear,
        quarter,
        submitted_to_adviser: true
        // Only get grades that have been submitted to adviser
      }).toArray();
    }
    const scheduleQuery = {
      section_id: section._id
    };
    if (section.school_year) {
      scheduleQuery.school_year = section.school_year;
    }
    const schedules = await db.collection("schedules").find(scheduleQuery).toArray();
    const subjectIds = schedules.length > 0 ? [...new Set(schedules.map((s) => s.subject_id).filter((id) => id))] : [];
    const subjects = subjectIds.length > 0 ? await db.collection("subjects").find({
      _id: { $in: subjectIds }
    }).toArray() : [];
    const teacherIds = schedules.length > 0 ? [...new Set(schedules.map((s) => s.teacher_id).filter((id) => id))] : [];
    const teachers = teacherIds.length > 0 ? await db.collection("users").find({
      _id: { $in: teacherIds },
      account_type: "teacher"
    }).toArray() : [];
    const subjectTeacherMap = {};
    schedules.forEach((schedule) => {
      if (schedule.teacher_id && schedule.subject_id) {
        const teacher2 = teachers.find((t) => t._id && t._id.toString() === schedule.teacher_id.toString());
        if (teacher2) {
          subjectTeacherMap[schedule.subject_id.toString()] = teacher2.full_name;
        }
      }
    });
    const studentsWithGrades = students.map((student) => {
      const studentGrades = gradesData.filter(
        (g) => g.student_id && student._id && g.student_id.toString() === student._id.toString()
      );
      const subjectGrades = subjects.map((subject) => {
        const subjectGrade = studentGrades.find(
          (g) => g.subject_id && subject._id && g.subject_id.toString() === subject._id.toString()
        );
        const isSubmittedToAdviser = subjectGrade?.submitted_to_adviser || false;
        return {
          subject_id: subject._id,
          subject_name: subject.name,
          subject_code: subject.code,
          teacher_name: subjectTeacherMap[subject._id.toString()] || "Unknown Teacher",
          averages: isSubmittedToAdviser ? subjectGrade?.averages || {
            written_work: 0,
            performance_tasks: 0,
            quarterly_assessment: 0,
            final_grade: 0
          } : {
            written_work: null,
            performance_tasks: null,
            quarterly_assessment: null,
            final_grade: null
          },
          verified: subjectGrade?.verified || false,
          verified_at: subjectGrade?.verified_at || null,
          submitted_to_adviser: isSubmittedToAdviser,
          submitted_at: subjectGrade?.submitted_at || null,
          submitted_by: subjectGrade?.submitted_by || null,
          grade_counts: isSubmittedToAdviser ? {
            written_work: subjectGrade?.written_work?.length || 0,
            performance_tasks: subjectGrade?.performance_tasks?.length || 0,
            quarterly_assessment: subjectGrade?.quarterly_assessment?.length || 0
          } : {
            written_work: 0,
            performance_tasks: 0,
            quarterly_assessment: 0
          }
        };
      });
      const validFinalGrades = subjectGrades.map((sg) => sg.averages.final_grade).filter((grade) => grade !== null && grade > 0);
      const overallAverage = validFinalGrades.length > 0 ? Math.round(validFinalGrades.reduce((sum, grade) => sum + grade, 0) / validFinalGrades.length * 100) / 100 : null;
      const allGradesVerified = subjectGrades.length > 0 && subjectGrades.every((sg) => sg.verified);
      return {
        id: student._id,
        name: student.full_name,
        student_number: student.account_number,
        grade_level: student.grade_level,
        subjects: subjectGrades,
        overall_average: overallAverage,
        grades_verified: allGradesVerified,
        total_subjects: subjects.length
      };
    });
    const validAverages = studentsWithGrades.map((s) => s.overall_average).filter((avg) => avg !== null && avg > 0);
    const classAverage = validAverages.length > 0 ? Math.round(validAverages.reduce((sum, avg) => sum + avg, 0) / validAverages.length * 100) / 100 : null;
    let room = null;
    if (section.room_id) {
      const roomId = ObjectId.isValid(section.room_id) ? new ObjectId(section.room_id) : section.room_id;
      room = await db.collection("rooms").findOne({ _id: roomId });
    }
    const teacher = await db.collection("users").findOne({
      _id: new ObjectId(teacherId),
      account_type: "teacher"
    });
    const advisoryData = {
      section_id: section._id,
      sectionName: section.name,
      gradeLevel: section.grade_level,
      schoolYear: section.school_year || schoolYear,
      // Fallback to query school year if section doesn't have one
      roomName: room ? room.name : "No room assigned",
      building: room?.building || "",
      floor: room?.floor || "",
      totalStudents: students.length,
      averageGrade: classAverage,
      subjectsCount: subjects.length,
      quarter,
      teacherName: teacher ? teacher.full_name : "Unknown Teacher",
      submittedDate: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      })
    };
    return json({
      success: true,
      data: {
        advisoryData,
        students: studentsWithGrades
      }
    });
  } catch (error) {
    return json({
      success: false,
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}
async function POST({ request }) {
  try {
    const db = await connectToDatabase();
    const body = await request.json();
    const { action } = body;
    if (action === "verify_student_grades") {
      const {
        student_id,
        section_id,
        teacher_id,
        quarter = 1,
        verified = true
      } = body;
      const school_year = body.school_year || await getCurrentSchoolYear(db);
      if (!student_id || !section_id || !teacher_id) {
        return json({ error: "Missing required fields" }, { status: 400 });
      }
      const teacher = await db.collection("users").findOne({
        _id: new ObjectId(teacher_id)
      }, { projection: { full_name: 1, gender: 1 } });
      const teacherName = teacher ? formatTeacherName(teacher.full_name, teacher.gender) : "Your teacher";
      const result = await db.collection("grades").updateMany(
        {
          student_id: new ObjectId(student_id),
          section_id: new ObjectId(section_id),
          school_year,
          quarter
        },
        {
          $set: {
            verified,
            verified_at: verified ? /* @__PURE__ */ new Date() : null,
            verified_by: verified ? new ObjectId(teacher_id) : null,
            updated_at: /* @__PURE__ */ new Date()
          }
        }
      );
      if (verified && result.modifiedCount > 0) {
        const verifiedGrades = await db.collection("grades").find({
          student_id: new ObjectId(student_id),
          section_id: new ObjectId(section_id),
          school_year,
          quarter,
          verified: true
        }).toArray();
        const subjectIds = verifiedGrades.map((grade) => grade.subject_id);
        const subjects = await db.collection("subjects").find({
          _id: { $in: subjectIds }
        }).toArray();
        for (const subject of subjects) {
          await createGradeVerificationNotification(
            db,
            student_id,
            teacherName,
            subject.name
          );
        }
      }
      return json({
        success: true,
        message: verified ? "Student grades verified successfully" : "Student grades unverified successfully",
        modified_count: result.modifiedCount
      });
    }
    if (action === "verify_all_grades") {
      const {
        section_id,
        teacher_id,
        quarter = 1,
        verified = true
      } = body;
      const school_year = body.school_year || await getCurrentSchoolYear(db);
      if (!section_id || !teacher_id) {
        return json({ error: "Missing required fields" }, { status: 400 });
      }
      const teacher = await db.collection("users").findOne({
        _id: new ObjectId(teacher_id)
      }, { projection: { full_name: 1, gender: 1 } });
      const teacherName = teacher ? formatTeacherName(teacher.full_name, teacher.gender) : "Your teacher";
      const studentsInSection = await db.collection("grades").distinct("student_id", {
        section_id: new ObjectId(section_id),
        school_year,
        quarter
      });
      const result = await db.collection("grades").updateMany(
        {
          section_id: new ObjectId(section_id),
          school_year,
          quarter
        },
        {
          $set: {
            verified,
            verified_at: verified ? /* @__PURE__ */ new Date() : null,
            verified_by: verified ? new ObjectId(teacher_id) : null,
            updated_at: /* @__PURE__ */ new Date()
          }
        }
      );
      if (verified && result.modifiedCount > 0 && studentsInSection.length > 0) {
        const verifiedGrades = await db.collection("grades").find({
          section_id: new ObjectId(section_id),
          school_year,
          quarter,
          verified: true
        }).toArray();
        const uniqueSubjectIds = [...new Set(verifiedGrades.map((grade) => grade.subject_id.toString()))];
        const subjects = await db.collection("subjects").find({
          _id: { $in: uniqueSubjectIds.map((id) => new ObjectId(id)) }
        }).toArray();
        for (const subject of subjects) {
          await createBulkGradeVerificationNotifications(
            db,
            studentsInSection.map((id) => id.toString()),
            teacherName,
            subject.name
          );
        }
      }
      return json({
        success: true,
        message: verified ? "All grades verified successfully" : "All grades unverified successfully",
        modified_count: result.modifiedCount
      });
    }
    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in teacher-advisory POST:", error);
    return json({
      success: false,
      error: "Internal server error"
    }, { status: 500 });
  }
}

export { GET, POST };
//# sourceMappingURL=_server-CLfmeiwB.js.map
