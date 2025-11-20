import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import { v as verifyAuth } from './auth-helper-DY2o5dhz.js';
import 'dotenv';

async function POST({ request }) {
  console.log("=== GRADES SAVE API CALLED ===");
  try {
    const authResult = await verifyAuth(request, ["teacher"]);
    if (!authResult.success) {
      console.log("Authentication failed:", authResult.error);
      return json({ error: authResult.error }, { status: authResult.status || 401 });
    }
    console.log("User authenticated:", authResult.user.account_number);
    const body = await request.json();
    console.log("Request body received:", JSON.stringify(body, null, 2));
    const { section_id, subject_id, grading_period_id, grading_config, grades } = body;
    if (!section_id || !subject_id || !grading_period_id || !grades || !Array.isArray(grades)) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }
    const teacherId = authResult.user.id;
    const db = await connectToDatabase();
    try {
      const schoolYearSetting = await db.collection("admin_settings").findOne({
        setting_key: "current_school_year"
      });
      const currentSchoolYear = schoolYearSetting?.setting_value || "2025-2026";
      console.log(`Using school year: ${currentSchoolYear}, quarter: ${grading_period_id}`);
      const results = {
        writtenWork: [],
        performanceTasks: [],
        quarterlyAssessment: []
      };
      for (const studentGrade of grades) {
        const studentAccountNumber = studentGrade.student_id;
        console.log(`Processing student: ${studentAccountNumber}`);
        console.log("Student grade data:", JSON.stringify(studentGrade, null, 2));
        let studentId;
        try {
          const student = await db.collection("users").findOne({
            account_number: studentAccountNumber,
            account_type: "student"
          });
          if (!student) {
            console.log(`Student not found: ${studentAccountNumber}`);
            continue;
          }
          studentId = student._id.toString();
          console.log(`Found student ID: ${studentId} for account: ${studentAccountNumber}`);
        } catch (error) {
          console.error(`Error finding student ${studentAccountNumber}:`, error);
          continue;
        }
        const filter = {
          student_id: new ObjectId(studentId),
          section_id: new ObjectId(section_id),
          subject_id: new ObjectId(subject_id),
          school_year: currentSchoolYear,
          quarter: grading_period_id
        };
        const existingGrade = await db.collection("grades").findOne(filter);
        if (existingGrade && existingGrade.verification && existingGrade.verification.verified) {
          console.log(`Skipping update for verified grades - student ${studentAccountNumber}`);
          continue;
        }
        const gradeData = {
          student_id: new ObjectId(studentId),
          section_id: new ObjectId(section_id),
          subject_id: new ObjectId(subject_id),
          school_year: currentSchoolYear,
          // Use dynamic school year from admin settings
          quarter: grading_period_id,
          // Use the quarter passed from the frontend
          written_work: studentGrade.writtenWork || [],
          performance_tasks: studentGrade.performanceTasks || [],
          quarterly_assessment: studentGrade.quarterlyAssessment || [],
          averages: {
            written_work: 0,
            performance_tasks: 0,
            quarterly_assessment: 0,
            final_grade: 0
          },
          // Preserve existing verification status or set default for new records
          verification: existingGrade?.verification || {
            verified: false,
            verified_by: null,
            verified_at: null
          },
          updated_at: /* @__PURE__ */ new Date(),
          updated_by: teacherId
        };
        console.log("Prepared grade data for MongoDB:", JSON.stringify(gradeData, null, 2));
        if (gradeData.written_work.length > 0) {
          const validScores = gradeData.written_work.filter((score) => score !== null && score !== void 0 && score !== "" && score !== 0);
          if (validScores.length > 0) {
            gradeData.averages.written_work = validScores.reduce((sum, score) => sum + parseFloat(score), 0) / validScores.length;
          }
        }
        if (gradeData.performance_tasks.length > 0) {
          const validScores = gradeData.performance_tasks.filter((score) => score !== null && score !== void 0 && score !== "" && score !== 0);
          if (validScores.length > 0) {
            gradeData.averages.performance_tasks = validScores.reduce((sum, score) => sum + parseFloat(score), 0) / validScores.length;
          }
        }
        if (gradeData.quarterly_assessment.length > 0) {
          const validScores = gradeData.quarterly_assessment.filter((score) => score !== null && score !== void 0 && score !== "" && score !== 0);
          if (validScores.length > 0) {
            gradeData.averages.quarterly_assessment = validScores.reduce((sum, score) => sum + parseFloat(score), 0) / validScores.length;
          }
        }
        const wwWeight = 0.3;
        const ptWeight = 0.5;
        const qaWeight = 0.2;
        gradeData.averages.final_grade = gradeData.averages.written_work * wwWeight + gradeData.averages.performance_tasks * ptWeight + gradeData.averages.quarterly_assessment * qaWeight;
        const result = await db.collection("grades").updateOne(
          filter,
          { $set: gradeData },
          { upsert: true }
        );
        console.log(`Grade record updated for student ${studentAccountNumber}:`, result);
      }
      return json({
        success: true,
        message: "Grades saved successfully",
        results
      });
    } catch (error) {
      console.error("Database operation error:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        sectionId: section_id,
        subjectId: subject_id,
        gradingPeriodId: grading_period_id,
        gradesCount: grades?.length
      });
      throw error;
    }
  } catch (error) {
    console.error("Error saving grades:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack
    });
    return json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export { POST };
//# sourceMappingURL=_server-Bd-d29gA.js.map
