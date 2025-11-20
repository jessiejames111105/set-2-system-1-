import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

async function GET({ url }) {
  try {
    const teacherId = url.searchParams.get("teacherId");
    if (!teacherId) {
      return json({
        success: false,
        error: "Teacher ID is required"
      }, { status: 400 });
    }
    const db = await connectToDatabase();
    const schoolYearSetting = await db.collection("admin_settings").findOne({
      setting_key: "current_school_year"
    });
    const schoolYear = url.searchParams.get("schoolYear") || schoolYearSetting?.setting_value || "2025-2026";
    const pipeline = [
      // Match schedules for the specific teacher and school year
      {
        $match: {
          teacher_id: new ObjectId(teacherId),
          school_year: schoolYear
        }
      },
      // Lookup section details
      {
        $lookup: {
          from: "sections",
          localField: "section_id",
          foreignField: "_id",
          as: "section"
        }
      },
      // Unwind section array
      {
        $unwind: "$section"
      },
      // Match only active sections
      {
        $match: {
          "section.status": "active"
        }
      },
      // Lookup subject details
      {
        $lookup: {
          from: "subjects",
          localField: "subject_id",
          foreignField: "_id",
          as: "subject"
        }
      },
      // Lookup section students
      {
        $lookup: {
          from: "section_students",
          let: { sectionId: "$section._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$section_id", "$$sectionId"] },
                    { $eq: ["$status", "active"] }
                  ]
                }
              }
            }
          ],
          as: "students"
        }
      },
      // Group by section to aggregate data
      {
        $group: {
          _id: "$section._id",
          section_name: { $first: "$section.name" },
          grade_level: { $first: "$section.grade_level" },
          school_year: { $first: "$section.school_year" },
          student_count: { $first: { $size: "$students" } },
          subjects: { $addToSet: { $arrayElemAt: ["$subject.name", 0] } },
          subject_count: { $addToSet: "$subject_id" }
        }
      },
      // Project final structure
      {
        $project: {
          section_id: "$_id",
          section_name: 1,
          grade_level: 1,
          school_year: 1,
          student_count: 1,
          subjects: { $filter: { input: "$subjects", cond: { $ne: ["$$this", null] } } },
          subject_count: { $size: "$subject_count" }
        }
      },
      // Sort by grade level and section name
      {
        $sort: {
          grade_level: 1,
          section_name: 1
        }
      }
    ];
    const result = await db.collection("schedules").aggregate(pipeline).toArray();
    const sectionsByGrade = {};
    let totalSections = 0;
    let totalStudents = 0;
    result.forEach((row) => {
      const gradeLevel = row.grade_level;
      if (!sectionsByGrade[gradeLevel]) {
        sectionsByGrade[gradeLevel] = {
          yearLevel: gradeLevel,
          gradeName: `Grade ${gradeLevel}`,
          sections: []
        };
      }
      sectionsByGrade[gradeLevel].sections.push({
        id: row.section_id.toString(),
        name: row.section_name,
        students: row.student_count || 0,
        subjects: row.subjects || [],
        subjectCount: row.subject_count || 0
      });
      totalSections++;
      totalStudents += row.student_count || 0;
    });
    const classData = Object.values(sectionsByGrade);
    const yearLevels = Object.keys(sectionsByGrade).map((level) => parseInt(level));
    const stats = {
      yearLevels,
      totalSections,
      totalStudents,
      averagePerSection: totalSections > 0 ? Math.round(totalStudents / totalSections) : 0
    };
    return json({
      success: true,
      data: {
        classData,
        stats
      }
    });
  } catch (error) {
    console.error("Error fetching teacher sections:", error);
    return json({
      success: false,
      error: "Failed to fetch teacher sections"
    }, { status: 500 });
  }
}

export { GET };
//# sourceMappingURL=_server-CnOcz2pp.js.map
