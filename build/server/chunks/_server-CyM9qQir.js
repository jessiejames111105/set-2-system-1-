import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { v as verifyAuth } from './auth-helper-DY2o5dhz.js';
import 'mongodb';
import 'dotenv';

async function GET({ url, request }) {
  try {
    const authResult = await verifyAuth(request, ["admin", "teacher", "adviser"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const db = await connectToDatabase();
    const schoolYearSetting = await db.collection("admin_settings").findOne({
      setting_key: "current_school_year"
    });
    const school_year = url.searchParams.get("school_year") || schoolYearSetting?.setting_value || "2025-2026";
    let currentQuarter = 1;
    if (!url.searchParams.has("quarter")) {
      try {
        const quarterSettings = await db.collection("admin_settings").find({
          setting_key: {
            $in: [
              "quarter_1_start_date",
              "quarter_1_end_date",
              "quarter_2_start_date",
              "quarter_2_end_date",
              "quarter_3_start_date",
              "quarter_3_end_date",
              "quarter_4_start_date",
              "quarter_4_end_date"
            ]
          }
        }).toArray();
        const settings = {};
        quarterSettings.forEach((row) => {
          settings[row.setting_key] = row.setting_value;
        });
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        const parseDate = (dateStr) => {
          if (!dateStr || dateStr.trim() === "") return null;
          const parts = dateStr.split("-");
          if (parts.length !== 3) return null;
          const [month, day, year] = parts.map((p) => parseInt(p, 10));
          if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
          return new Date(year, month - 1, day);
        };
        const quarters = [
          { num: 1, start: parseDate(settings.quarter_1_start_date), end: parseDate(settings.quarter_1_end_date) },
          { num: 2, start: parseDate(settings.quarter_2_start_date), end: parseDate(settings.quarter_2_end_date) },
          { num: 3, start: parseDate(settings.quarter_3_start_date), end: parseDate(settings.quarter_3_end_date) },
          { num: 4, start: parseDate(settings.quarter_4_start_date), end: parseDate(settings.quarter_4_end_date) }
        ];
        for (const quarter2 of quarters) {
          if (quarter2.start && quarter2.end && today >= quarter2.start && today <= quarter2.end) {
            currentQuarter = quarter2.num;
            break;
          }
        }
      } catch (error) {
        console.error("Error determining current quarter:", error);
      }
    }
    const quarter = parseInt(url.searchParams.get("quarter")) || currentQuarter;
    const activeStudents = await db.collection("users").find({
      account_type: "student",
      status: "active"
    }).toArray();
    if (activeStudents.length === 0) {
      return json({
        success: true,
        students: [],
        message: "No active students found"
      });
    }
    const studentIds = activeStudents.map((student) => student._id);
    const sectionEnrollments = await db.collection("section_students").find({
      student_id: { $in: studentIds },
      status: "active"
    }).toArray();
    const studentSectionMap = {};
    sectionEnrollments.forEach((enrollment) => {
      studentSectionMap[enrollment.student_id.toString()] = enrollment.section_id;
    });
    const sectionIds = [...new Set(Object.values(studentSectionMap))];
    const sections = await db.collection("sections").find({
      _id: { $in: sectionIds },
      status: "active"
    }).toArray();
    const sectionMap = {};
    sections.forEach((section) => {
      sectionMap[section._id.toString()] = section;
    });
    const calculateOverall = url.searchParams.get("quarter") === "all";
    let gradesData;
    if (calculateOverall) {
      gradesData = await db.collection("grades").find({
        student_id: { $in: studentIds },
        school_year,
        $or: [
          { verified: true },
          { "verification.verified": true }
        ]
      }).toArray();
    } else {
      gradesData = await db.collection("grades").find({
        student_id: { $in: studentIds },
        school_year,
        quarter,
        $or: [
          { verified: true },
          { "verification.verified": true }
        ]
      }).toArray();
    }
    const studentGradesMap = {};
    gradesData.forEach((grade) => {
      const studentId = grade.student_id.toString();
      if (!studentGradesMap[studentId]) {
        studentGradesMap[studentId] = [];
      }
      studentGradesMap[studentId].push(grade);
    });
    const studentsWithGrades = activeStudents.map((student) => {
      const studentId = student._id.toString();
      const sectionId = studentSectionMap[studentId];
      const section = sectionId && sectionMap[sectionId.toString()];
      const studentGrades = studentGradesMap[studentId] || [];
      let gwa = 0;
      if (calculateOverall) {
        const quarterAverages = {};
        studentGrades.forEach((grade) => {
          const quarter2 = grade.quarter;
          if (!quarterAverages[quarter2]) {
            quarterAverages[quarter2] = [];
          }
          if (grade.averages && grade.averages.final_grade && grade.averages.final_grade > 0) {
            quarterAverages[quarter2].push(grade.averages.final_grade);
          }
        });
        const quarterGWAs = [];
        Object.keys(quarterAverages).forEach((quarter2) => {
          const grades = quarterAverages[quarter2];
          if (grades.length > 0) {
            const quarterGWA = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
            quarterGWAs.push(quarterGWA);
          }
        });
        if (quarterGWAs.length > 0) {
          gwa = quarterGWAs.reduce((sum, qGWA) => sum + qGWA, 0) / quarterGWAs.length;
        }
      } else {
        if (studentGrades.length > 0) {
          const validGrades = studentGrades.filter(
            (grade) => grade.averages && grade.averages.final_grade && grade.averages.final_grade > 0
          );
          if (validGrades.length > 0) {
            const totalGrades = validGrades.reduce(
              (sum, grade) => sum + grade.averages.final_grade,
              0
            );
            gwa = totalGrades / validGrades.length;
          }
        }
      }
      const formattedGwa = Math.round(gwa * 10) / 10;
      const gwaDisplay = formattedGwa === Math.floor(formattedGwa) ? Math.floor(formattedGwa) : Number(formattedGwa.toFixed(1));
      return {
        id: student.account_number,
        _id: student._id.toString(),
        name: student.full_name,
        email: student.email,
        gradeLevel: section ? section.grade_level.toString() : student.grade_level?.toString() || "N/A",
        section: section ? section.name : "No Section",
        gwa: gwaDisplay,
        totalSubjects: studentGrades.length,
        verifiedGrades: studentGrades.filter(
          (grade) => grade.verified === true || grade.verification?.verified === true
        ).length
      };
    }).sort((a, b) => {
      const extractNumber = (id) => {
        const match = id.match(/-(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      };
      const numA = extractNumber(a.id);
      const numB = extractNumber(b.id);
      return numA - numB;
    });
    return json({
      success: true,
      students: studentsWithGrades,
      metadata: {
        totalStudents: studentsWithGrades.length,
        schoolYear: school_year,
        quarter: calculateOverall ? "all" : quarter,
        quarterDisplay: calculateOverall ? "Overall (All Quarters)" : `Quarter ${quarter}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  } catch (error) {
    console.error("Error fetching students bulk data:", error);
    return json({
      success: false,
      error: "Failed to fetch students data",
      students: []
    }, { status: 500 });
  }
}

export { GET };
//# sourceMappingURL=_server-CyM9qQir.js.map
