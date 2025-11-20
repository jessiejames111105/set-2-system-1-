import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import { f as formatTeacherName, c as createGradeVerificationNotification } from './notification-helper-DJAg4ynO.js';
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
    const currentSchoolYear = await getCurrentSchoolYear(db);
    const student_id = url.searchParams.get("student_id");
    const teacher_id = url.searchParams.get("teacher_id");
    const section_id = url.searchParams.get("section_id");
    const subject_id = url.searchParams.get("subject_id");
    const school_year = url.searchParams.get("school_year") || currentSchoolYear;
    const quarter = parseInt(url.searchParams.get("quarter")) || 1;
    const action = url.searchParams.get("action");
    if (action === "student_grades" && student_id) {
      if (currentUser.account_type === "student" && currentUser.id !== student_id) {
        return json({ error: "Unauthorized: You can only view your own grades" }, { status: 403 });
      }
      if (currentUser.account_type === "teacher" && teacher_id && teacher_id !== currentUser.id) {
        return json({ error: "Unauthorized: You can only view grades for your own students" }, { status: 403 });
      }
      const grades = await db.collection("grades").findOne({
        student_id: new ObjectId(student_id),
        section_id: new ObjectId(section_id),
        subject_id: new ObjectId(subject_id),
        school_year,
        quarter
      });
      return json({
        success: true,
        grades: grades || {
          written_work: [],
          performance_tasks: [],
          quarterly_assessment: [],
          averages: {
            written_work: 0,
            performance_tasks: 0,
            quarterly_assessment: 0,
            final_grade: 0
          },
          verified: false
        }
      });
    }
    if (action === "section_grades" && section_id && subject_id && teacher_id) {
      if (currentUser.account_type === "teacher" && teacher_id !== currentUser.id) {
        return json({ error: "Unauthorized: You can only view grades for your own classes" }, { status: 403 });
      }
      if (currentUser.account_type === "adviser") {
        const section = await db.collection("sections").findOne({
          _id: new ObjectId(section_id),
          adviser_id: new ObjectId(currentUser.id)
        });
        if (!section) {
          return json({ error: "Unauthorized: You can only view grades for your advisory section" }, { status: 403 });
        }
      }
      const pipeline = [
        {
          $match: {
            section_id: new ObjectId(section_id),
            subject_id: new ObjectId(subject_id),
            school_year,
            quarter
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "student_id",
            foreignField: "_id",
            as: "student"
          }
        },
        {
          $unwind: "$student"
        },
        {
          $project: {
            student_id: 1,
            student_name: "$student.full_name",
            student_number: "$student.account_number",
            written_work: 1,
            performance_tasks: 1,
            quarterly_assessment: 1,
            averages: 1,
            verified: 1,
            verified_at: 1,
            updated_at: 1
          }
        },
        {
          $sort: { student_name: 1 }
        }
      ];
      const grades = await db.collection("grades").aggregate(pipeline).toArray();
      return json({
        success: true,
        grades
      });
    }
    if (action === "advisory_grades" && section_id && teacher_id) {
      if (currentUser.account_type === "adviser") {
        const section = await db.collection("sections").findOne({
          _id: new ObjectId(section_id),
          adviser_id: new ObjectId(currentUser.id)
        });
        if (!section) {
          return json({ error: "Unauthorized: You can only view grades for your advisory section" }, { status: 403 });
        }
      } else if (currentUser.account_type === "teacher") {
        return json({ error: "Unauthorized: Only advisers and admins can view advisory grades" }, { status: 403 });
      }
      const pipeline = [
        {
          $match: {
            section_id: new ObjectId(section_id),
            school_year,
            quarter
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "student_id",
            foreignField: "_id",
            as: "student"
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
          $unwind: "$student"
        },
        {
          $unwind: "$subject"
        },
        {
          $group: {
            _id: "$student_id",
            student_name: { $first: "$student.full_name" },
            student_number: { $first: "$student.account_number" },
            subjects: {
              $push: {
                subject_id: "$subject_id",
                subject_name: "$subject.name",
                subject_code: "$subject.code",
                averages: "$averages",
                verified: "$verified",
                verified_at: "$verified_at"
              }
            }
          }
        },
        {
          $addFields: {
            overall_average: {
              $avg: "$subjects.averages.final_grade"
            }
          }
        },
        {
          $sort: { student_name: 1 }
        }
      ];
      const students = await db.collection("grades").aggregate(pipeline).toArray();
      return json({
        success: true,
        students
      });
    }
    return json({ error: "Invalid action or missing parameters" }, { status: 400 });
  } catch (error) {
    console.error("Error in grades GET:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
async function POST({ request }) {
  try {
    const authResult = await verifyAuth(request, ["teacher", "adviser", "admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: 401 });
    }
    const currentUser = authResult.user;
    console.log("POST handler called - attempting database connection...");
    const db = await connectToDatabase();
    console.log("Database connection result:", db);
    if (!db) {
      console.error("Database connection is null/undefined");
      return json({ error: "Database connection failed" }, { status: 500 });
    }
    const currentSchoolYear = await getCurrentSchoolYear(db);
    const body = await request.json();
    const { action } = body;
    if (action === "add_grade_item") {
      const {
        student_id,
        teacher_id,
        section_id,
        subject_id,
        school_year = currentSchoolYear,
        quarter = 1,
        category,
        name,
        score,
        total_score,
        date_given
      } = body;
      if (!student_id || !teacher_id || !section_id || !subject_id || !category || !name) {
        return json({ error: "Missing required fields" }, { status: 400 });
      }
      if (currentUser.account_type === "teacher" && teacher_id !== currentUser.id) {
        return json({ error: "Unauthorized: You can only add grades for your own classes" }, { status: 403 });
      }
      if (!["written_work", "performance_tasks", "quarterly_assessment"].includes(category)) {
        return json({ error: "Invalid category" }, { status: 400 });
      }
      const gradeItem = {
        name,
        score: score || 0,
        total_score: total_score || 100,
        date_given: date_given ? new Date(date_given) : /* @__PURE__ */ new Date(),
        created_at: /* @__PURE__ */ new Date()
      };
      const filter = {
        student_id: new ObjectId(student_id),
        section_id: new ObjectId(section_id),
        subject_id: new ObjectId(subject_id),
        school_year,
        quarter
      };
      const update = {
        $push: {
          [category]: gradeItem
        },
        $setOnInsert: {
          teacher_id: new ObjectId(teacher_id),
          written_work: [],
          performance_tasks: [],
          quarterly_assessment: [],
          averages: {
            written_work: 0,
            performance_tasks: 0,
            quarterly_assessment: 0,
            final_grade: 0
          },
          verified: false,
          created_at: /* @__PURE__ */ new Date()
        },
        $set: {
          updated_at: /* @__PURE__ */ new Date()
        }
      };
      const result = await db.collection("grades").updateOne(filter, update, { upsert: true });
      await recalculateAverages(db, filter);
      return json({
        success: true,
        message: "Grade item added successfully",
        result
      });
    }
    if (action === "update_grade") {
      const {
        student_id,
        section_id,
        subject_id,
        school_year = currentSchoolYear,
        quarter = 1,
        category,
        grade_index,
        score,
        teacher_id
      } = body;
      if (currentUser.account_type === "teacher") {
        if (!teacher_id || teacher_id !== currentUser.id) {
          return json({ error: "Unauthorized: You can only update grades for your own classes" }, { status: 403 });
        }
      }
      const filter = {
        student_id: new ObjectId(student_id),
        section_id: new ObjectId(section_id),
        subject_id: new ObjectId(subject_id),
        school_year,
        quarter
      };
      const existingGrade = await db.collection("grades").findOne(filter);
      if (existingGrade && existingGrade.verification && existingGrade.verification.verified) {
        return json({
          success: false,
          error: "Cannot update grades that have been verified by the adviser"
        }, { status: 403 });
      }
      const update = {
        $set: {
          [`${category}.${grade_index}.score`]: score,
          updated_at: /* @__PURE__ */ new Date()
        }
      };
      await db.collection("grades").updateOne(filter, update);
      await recalculateAverages(db, filter);
      return json({
        success: true,
        message: "Grade updated successfully"
      });
    }
    if (action === "verify_grades") {
      const {
        student_id,
        section_id,
        subject_id,
        school_year = currentSchoolYear,
        quarter = 1,
        teacher_id,
        verified = true
      } = body;
      if (currentUser.account_type === "adviser") {
        const section = await db.collection("sections").findOne({
          _id: new ObjectId(section_id),
          adviser_id: new ObjectId(currentUser.id)
        });
        if (!section) {
          return json({ error: "Unauthorized: You can only verify grades for your advisory section" }, { status: 403 });
        }
      } else if (currentUser.account_type === "teacher") {
        return json({ error: "Unauthorized: Only advisers and admins can verify grades" }, { status: 403 });
      }
      const filter = {
        student_id: new ObjectId(student_id),
        section_id: new ObjectId(section_id),
        subject_id: new ObjectId(subject_id),
        school_year,
        quarter
      };
      const teacher = await db.collection("users").findOne({
        _id: new ObjectId(teacher_id)
      }, { projection: { full_name: 1, gender: 1 } });
      const subject = await db.collection("subjects").findOne({
        _id: new ObjectId(subject_id)
      }, { projection: { name: 1 } });
      const teacherName = teacher ? formatTeacherName(teacher.full_name, teacher.gender) : "Your teacher";
      const subjectName = subject ? subject.name : "Subject";
      const update = {
        $set: {
          verified,
          verified_at: verified ? /* @__PURE__ */ new Date() : null,
          verified_by: verified ? new ObjectId(teacher_id) : null,
          updated_at: /* @__PURE__ */ new Date()
        }
      };
      const result = await db.collection("grades").updateOne(filter, update);
      if (verified && result.modifiedCount > 0) {
        await createGradeVerificationNotification(
          db,
          student_id,
          teacherName,
          subjectName
        );
      }
      return json({
        success: true,
        message: verified ? "Grades verified successfully" : "Grades unverified successfully"
      });
    }
    if (action === "submit_final_grades") {
      const {
        section_id,
        subject_id,
        grading_period_id = 1,
        final_grades,
        teacher_id
      } = body;
      console.log("Submit final grades request:", {
        section_id,
        subject_id,
        grading_period_id,
        teacher_id,
        final_grades_count: final_grades?.length
      });
      if (!section_id || !subject_id || !final_grades || !Array.isArray(final_grades)) {
        return json({ error: "Missing required fields" }, { status: 400 });
      }
      if (!teacher_id) {
        return json({ error: "Teacher authentication required" }, { status: 401 });
      }
      if (currentUser.account_type === "teacher" && teacher_id !== currentUser.id) {
        return json({ error: "Unauthorized: You can only submit grades for your own classes" }, { status: 403 });
      }
      const processedStudents = [];
      const errors = [];
      for (const gradeData of final_grades) {
        try {
          const { student_id, written_work_average, performance_tasks_average, quarterly_assessment_average, final_grade, written_work_items, performance_tasks_items, quarterly_assessment_items } = gradeData;
          console.log("Processing student:", { student_id, final_grade });
          if (!student_id) {
            errors.push("Missing student_id for one or more students");
            continue;
          }
          const student = await db.collection("users").findOne({
            account_number: student_id,
            account_type: "student"
          });
          console.log("Found student:", student ? { id: student._id, name: student.full_name } : "Not found");
          if (!student) {
            errors.push(`Student not found: ${student_id}`);
            continue;
          }
          const gradeDoc = {
            student_id: student._id,
            section_id: new ObjectId(section_id),
            subject_id: new ObjectId(subject_id),
            teacher_id: new ObjectId(teacher_id),
            school_year: currentSchoolYear,
            quarter: grading_period_id,
            written_work: written_work_items || [],
            performance_tasks: performance_tasks_items || [],
            quarterly_assessment: quarterly_assessment_items || [],
            averages: {
              written_work: written_work_average || 0,
              performance_tasks: performance_tasks_average || 0,
              quarterly_assessment: quarterly_assessment_average || 0,
              final_grade: final_grade || 0
            },
            verified: false,
            submitted_to_adviser: true,
            submitted_at: /* @__PURE__ */ new Date(),
            submitted_by: new ObjectId(teacher_id),
            created_at: /* @__PURE__ */ new Date(),
            updated_at: /* @__PURE__ */ new Date()
          };
          console.log("Saving grade document:", {
            student_id: student._id,
            submitted_to_adviser: gradeDoc.submitted_to_adviser,
            final_grade: gradeDoc.averages.final_grade
          });
          const filter = {
            student_id: student._id,
            section_id: new ObjectId(section_id),
            subject_id: new ObjectId(subject_id),
            school_year: currentSchoolYear,
            quarter: grading_period_id
          };
          const result = await db.collection("grades").updateOne(
            filter,
            { $set: gradeDoc },
            { upsert: true }
          );
          console.log("Database update result:", result);
          processedStudents.push({
            student_id,
            student_name: student.full_name || `${student.first_name} ${student.last_name}`,
            final_grade
          });
        } catch (error) {
          console.error(`Error processing student ${gradeData.student_id}:`, error);
          errors.push(`Error processing student ${gradeData.student_id}: ${error.message}`);
        }
      }
      return json({
        success: true,
        message: `Final grades submitted to adviser for ${processedStudents.length} students`,
        processed_students: processedStudents,
        errors: errors.length > 0 ? errors : void 0
      });
    }
    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in grades POST:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
async function recalculateAverages(db, filter) {
  const gradeDoc = await db.collection("grades").findOne(filter);
  if (!gradeDoc) return;
  const calculateCategoryAverage = (items) => {
    if (!items || items.length === 0) return 0;
    const validItems = items.filter((item) => item.score !== null && item.score !== void 0);
    if (validItems.length === 0) return 0;
    const totalScore = validItems.reduce((sum, item) => sum + item.score, 0);
    const totalPossible = validItems.reduce((sum, item) => sum + item.total_score, 0);
    return totalPossible > 0 ? Math.round(totalScore / totalPossible * 100 * 100) / 100 : 0;
  };
  const writtenWorkAvg = calculateCategoryAverage(gradeDoc.written_work);
  const performanceTasksAvg = calculateCategoryAverage(gradeDoc.performance_tasks);
  const quarterlyAssessmentAvg = calculateCategoryAverage(gradeDoc.quarterly_assessment);
  const finalGrade = Math.round((writtenWorkAvg * 0.3 + performanceTasksAvg * 0.5 + quarterlyAssessmentAvg * 0.2) * 100) / 100;
  await db.collection("grades").updateOne(filter, {
    $set: {
      "averages.written_work": writtenWorkAvg,
      "averages.performance_tasks": performanceTasksAvg,
      "averages.quarterly_assessment": quarterlyAssessmentAvg,
      "averages.final_grade": finalGrade,
      updated_at: /* @__PURE__ */ new Date()
    }
  });
}
async function DELETE({ request }) {
  try {
    const authResult = await verifyAuth(request, ["teacher", "adviser", "admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: 401 });
    }
    const currentUser = authResult.user;
    const db = await connectToDatabase();
    const currentSchoolYear = await getCurrentSchoolYear(db);
    const body = await request.json();
    const {
      student_id,
      section_id,
      subject_id,
      school_year = currentSchoolYear,
      quarter = 1,
      category,
      grade_index,
      teacher_id
    } = body;
    if (currentUser.account_type === "teacher") {
      if (!teacher_id || teacher_id !== currentUser.id) {
        return json({ error: "Unauthorized: You can only delete grades for your own classes" }, { status: 403 });
      }
    }
    const filter = {
      student_id: new ObjectId(student_id),
      section_id: new ObjectId(section_id),
      subject_id: new ObjectId(subject_id),
      school_year,
      quarter
    };
    const gradeDoc = await db.collection("grades").findOne(filter);
    if (!gradeDoc || !gradeDoc[category] || !gradeDoc[category][grade_index]) {
      return json({ error: "Grade item not found" }, { status: 404 });
    }
    const update = {
      $unset: {
        [`${category}.${grade_index}`]: 1
      }
    };
    await db.collection("grades").updateOne(filter, update);
    await db.collection("grades").updateOne(filter, {
      $pull: {
        [category]: null
      },
      $set: {
        updated_at: /* @__PURE__ */ new Date()
      }
    });
    await recalculateAverages(db, filter);
    return json({
      success: true,
      message: "Grade item deleted successfully"
    });
  } catch (error) {
    console.error("Error in grades DELETE:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

export { DELETE, GET, POST };
//# sourceMappingURL=_server-DkVzhzh_.js.map
