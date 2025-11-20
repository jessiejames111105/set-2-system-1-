import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
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
async function GET({ url }) {
  try {
    const teacherId = url.searchParams.get("teacherId");
    if (!teacherId) {
      return json({ error: "Teacher ID is required" }, { status: 400 });
    }
    const db = await connectToDatabase();
    const currentSchoolYear = await getCurrentSchoolYear(db);
    const users = db.collection("users");
    const teacher = await users.findOne({
      _id: new ObjectId(teacherId),
      account_type: "teacher"
    });
    if (!teacher) {
      return json({ error: "Teacher not found" }, { status: 404 });
    }
    const schedulesCollection = db.collection("schedules");
    const sectionsCollection = db.collection("sections");
    const subjectsCollection = db.collection("subjects");
    const sectionStudentsCollection = db.collection("section_students");
    const teacherSchedules = await schedulesCollection.find({
      teacher_id: new ObjectId(teacherId),
      school_year: currentSchoolYear
    }).toArray();
    const sectionsMap = /* @__PURE__ */ new Map();
    const subjectsMap = /* @__PURE__ */ new Map();
    for (const schedule of teacherSchedules) {
      const sectionId = schedule.section_id.toString();
      const subjectId = schedule.subject_id.toString();
      if (!sectionsMap.has(sectionId)) {
        const section = await sectionsCollection.findOne({
          _id: schedule.section_id
        });
        if (section) {
          const studentCount = await sectionStudentsCollection.countDocuments({
            section_id: schedule.section_id,
            status: "active"
          });
          sectionsMap.set(sectionId, {
            id: section._id.toString(),
            name: section.name,
            grade_level: section.grade_level,
            school_year: section.school_year,
            student_count: studentCount,
            subjects: []
          });
        }
      }
      const subject = await subjectsCollection.findOne({
        _id: schedule.subject_id
      });
      if (subject) {
        if (sectionsMap.has(sectionId)) {
          const sectionData = sectionsMap.get(sectionId);
          const existingSubject = sectionData.subjects.find((s) => s.id === subjectId);
          if (!existingSubject) {
            sectionData.subjects.push({
              id: subject._id.toString(),
              name: subject.name,
              code: subject.code
            });
          }
        }
        if (!subjectsMap.has(subjectId)) {
          const subjectSections = teacherSchedules.filter((s) => s.subject_id.toString() === subjectId);
          const uniqueSectionIds = [...new Set(subjectSections.map((s) => s.section_id.toString()))];
          subjectsMap.set(subjectId, {
            id: subject._id.toString(),
            name: subject.name,
            code: subject.code,
            grade_level: subject.grade_level,
            section_count: uniqueSectionIds.length,
            sections: uniqueSectionIds,
            color: getSubjectColor(subject.name)
          });
        }
      }
    }
    const sections = Array.from(sectionsMap.values());
    const subjects = Array.from(subjectsMap.values());
    let advisorySection = null;
    const advisoryData = await sectionsCollection.findOne({
      adviser_id: new ObjectId(teacherId),
      school_year: currentSchoolYear
    });
    if (advisoryData) {
      const advisoryStudentCount = await sectionStudentsCollection.countDocuments({
        section_id: advisoryData._id,
        status: "active"
      });
      advisorySection = {
        id: advisoryData._id.toString(),
        name: advisoryData.name,
        grade_level: advisoryData.grade_level,
        school_year: advisoryData.school_year,
        student_count: advisoryStudentCount
      };
    }
    const profileData = {
      teacher: {
        id: teacher._id.toString(),
        full_name: teacher.full_name,
        email: teacher.email,
        position: teacher.position || "Teacher",
        department: teacher.department || "General"
      },
      sections,
      subjects,
      advisory_section: advisorySection,
      current_school_year: currentSchoolYear,
      total_sections: sections.length,
      total_subjects: subjects.length,
      total_students: sections.reduce((sum, section) => sum + section.student_count, 0)
    };
    return json({ success: true, data: profileData });
  } catch (error) {
    console.error("Error fetching teacher profile:", error);
    return json({
      error: "Failed to fetch teacher profile data",
      details: error.message
    }, { status: 500 });
  }
}
function getSubjectColor(subjectName) {
  const subjectColors = {
    "Mathematics": ["#4F46E5", "#6366F1", "#8B5CF6", "#3B82F6"],
    // Blues and purples
    "Math": ["#4F46E5", "#6366F1", "#8B5CF6", "#3B82F6"],
    "Science": ["#059669", "#10B981", "#34D399", "#047857"],
    // Greens
    "English": ["#DC2626", "#EF4444", "#F87171", "#B91C1C"],
    // Reds
    "Physical Education": ["#EA580C", "#F97316", "#FB923C", "#C2410C"],
    // Oranges
    "MAPEH": ["#EA580C", "#F97316", "#FB923C", "#C2410C"],
    // Oranges
    "PE": ["#EA580C", "#F97316", "#FB923C", "#C2410C"],
    "Filipino": ["#7C2D12", "#A16207", "#D97706", "#92400E"],
    // Browns and ambers
    "Araling Panlipunan": ["#B45309", "#D97706", "#F59E0B", "#A16207"],
    // Ambers
    "History": ["#B45309", "#D97706", "#F59E0B", "#A16207"],
    "Computer": ["#6366F1", "#8B5CF6", "#A855F7", "#7C3AED"],
    // Purples
    "Technology": ["#6366F1", "#8B5CF6", "#A855F7", "#7C3AED"],
    "Arts": ["#C026D3", "#D946EF", "#E879F9", "#A21CAF"],
    // Magentas
    "Music": ["#EC4899", "#F472B6", "#F9A8D4", "#DB2777"],
    // Pinks
    "Health": ["#16A34A", "#22C55E", "#4ADE80", "#15803D"],
    // Light greens
    "Values": ["#0891B2", "#06B6D4", "#22D3EE", "#0E7490"],
    // Cyans
    "Research": ["#7C2D12", "#A16207", "#D97706", "#92400E"],
    // Browns
    "TLE": ["#9333EA", "#A855F7", "#C084FC", "#7E22CE"],
    // Violets
    "ESP": ["#0891B2", "#06B6D4", "#22D3EE", "#0E7490"]
    // Cyans
  };
  const fallbackColors = [
    "#EF4444",
    "#F97316",
    "#F59E0B",
    "#84CC16",
    "#22C55E",
    "#10B981",
    "#14B8A6",
    "#06B6D4",
    "#0EA5E9",
    "#3B82F6",
    "#6366F1",
    "#8B5CF6",
    "#A855F7",
    "#D946EF",
    "#EC4899",
    "#F43F5E",
    "#E11D48",
    "#BE123C",
    "#9F1239",
    "#881337"
  ];
  function simpleHash(str) {
    let hash2 = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash2 = (hash2 << 5) - hash2 + char;
      hash2 = hash2 & hash2;
    }
    return Math.abs(hash2);
  }
  const normalizedName = subjectName.toLowerCase().trim();
  for (const [key, colorArray] of Object.entries(subjectColors)) {
    if (normalizedName.includes(key.toLowerCase())) {
      const hash2 = simpleHash(subjectName);
      const colorIndex2 = hash2 % colorArray.length;
      return colorArray[colorIndex2];
    }
  }
  const hash = simpleHash(subjectName);
  const colorIndex = hash % fallbackColors.length;
  return fallbackColors[colorIndex];
}

export { GET };
//# sourceMappingURL=_server-Bsd-SyVb.js.map
