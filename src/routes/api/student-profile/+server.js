import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { verifyAuth } from '../helper/auth-helper.js';
import { ObjectId } from 'mongodb';

// Helper function to get current school year from admin settings
async function getCurrentSchoolYear(db) {
  try {
    const schoolYearSetting = await db.collection('admin_settings').findOne({
      setting_key: 'current_school_year'
    });
    return schoolYearSetting?.setting_value || '2025-2026';
  } catch (error) {
    console.error('Error fetching current school year:', error);
    return '2025-2026'; // Default fallback
  }
}

// GET /api/student-profile - Get comprehensive student profile data
export async function GET({ url, request }) {
  try {
    // Verify authentication - only students, teachers, advisers, and admins can access student profiles
    const authResult = await verifyAuth(request, ['student', 'teacher', 'adviser', 'admin']);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: 401 });
    }
    const currentUser = authResult.user;
    
    const studentId = url.searchParams.get('studentId');
    
    if (!studentId) {
      return json({ error: 'Student ID is required' }, { status: 400 });
    }
    
    // Authorization check: students can only view their own profile
    if (currentUser.account_type === 'student' && currentUser.id !== studentId) {
      return json({ 
        error: 'Unauthorized: You can only view your own profile' 
      }, { status: 403 });
    }

    const db = await connectToDatabase();
    
    // Get current school year from admin settings
    const currentSchoolYear = await getCurrentSchoolYear(db);

    // Get student's section information
    const sectionStudents = db.collection('section_students');
    const sections = db.collection('sections');
    const users = db.collection('users');

    // Find active section enrollment for the student
    const sectionEnrollment = await sectionStudents.findOne({
      student_id: new ObjectId(studentId),
      status: 'active'
    });

    // Get student's basic info to determine grade level
    const student = await users.findOne({
      _id: new ObjectId(studentId),
      account_type: 'student'
    });

    if (!student) {
      return json({ error: 'Student not found' }, { status: 404 });
    }
    
    // For teachers: verify they teach this student
    if (currentUser.account_type === 'teacher') {
      const teacherSchedules = await db.collection('schedules').find({
        teacher_id: new ObjectId(currentUser.id),
        schedule_type: 'subject'
      }).toArray();
      
      const teacherSectionIds = teacherSchedules.map(s => s.section_id);
      
      const studentInTeacherSection = await db.collection('section_students').findOne({
        student_id: new ObjectId(studentId),
        section_id: { $in: teacherSectionIds },
        status: 'active'
      });
      
      if (!studentInTeacherSection) {
        return json({ 
          error: 'Unauthorized: You can only view profiles of your students' 
        }, { status: 403 });
      }
    }
    
    // For advisers: verify this is their advisory student
    if (currentUser.account_type === 'adviser') {
      const advisorySection = await db.collection('sections').findOne({
        adviser_id: new ObjectId(currentUser.id),
        status: 'active'
      });
      
      if (advisorySection) {
        const studentInAdvisorySection = await db.collection('section_students').findOne({
          student_id: new ObjectId(studentId),
          section_id: advisorySection._id,
          status: 'active'
        });
        
        if (!studentInAdvisorySection) {
          return json({ 
            error: 'Unauthorized: You can only view profiles of students in your advisory section' 
          }, { status: 403 });
        }
      } else {
        return json({ 
          error: 'Unauthorized: You can only view profiles of students in your advisory section' 
        }, { status: 403 });
      }
    }

    let sectionInfo = null;
    let studentGradeLevel = null;

    if (sectionEnrollment) {
      // Get section details with adviser information
      const sectionData = await sections.findOne({
        _id: sectionEnrollment.section_id
      });

      if (sectionData) {
        studentGradeLevel = sectionData.grade_level;
        let adviserName = 'Not assigned';
        if (sectionData.adviser_id) {
          const adviser = await users.findOne({
            _id: sectionData.adviser_id
          });
          if (adviser) {
            adviserName = adviser.full_name;
          }
        }

        sectionInfo = {
          section_id: sectionData._id,
          section_name: sectionData.name,
          grade_level: sectionData.grade_level,
          school_year: sectionData.school_year, // Include section's school year
          adviser_name: adviserName
        };
      }
    } else {
      // Student has no section, use grade level from user profile
      studentGradeLevel = parseInt(student.grade_level);
    }

    // Get student's enrolled subjects with teacher information
    let subjects = [];
    if (studentGradeLevel) {
      const subjectsCollection = db.collection('subjects');
      const schedulesCollection = db.collection('schedules');
      const departmentsCollection = db.collection('departments');

      // Get all subjects for the student's grade level
      const subjectsList = await subjectsCollection.find({
        grade_level: studentGradeLevel
      }).sort({ name: 1 }).toArray();

      // For each subject, try to find teacher and department info
      for (const subject of subjectsList) {
        let teacherName = 'No teacher';
        let departmentName = 'General';

        // Only try to find teacher if student has a section
        if (sectionInfo) {
          // Find schedule for this subject and section to get teacher
          // Use section's school year for schedules (historical data)
          const schedule = await schedulesCollection.findOne({
            subject_id: subject._id,
            section_id: sectionInfo.section_id,
            school_year: sectionInfo.school_year // Use section's school year for schedules
          });

          if (schedule && schedule.teacher_id) {
            const teacher = await users.findOne({
              _id: schedule.teacher_id,
              account_type: 'teacher'
            });
            if (teacher) {
              teacherName = teacher.full_name;
            }
          }
        }

        // Get department name
        if (subject.department_id) {
          const department = await departmentsCollection.findOne({
            _id: subject.department_id
          });
          if (department) {
            departmentName = department.name;
          }
        }

        subjects.push({
          id: subject._id.toString(),
          name: subject.name,
          code: subject.code,
          department: departmentName,
          teacher: teacherName,
          color: getSubjectColor(subject.name)
        });
      }
    }

    // Calculate student's general average from grades using current school year
    let generalAverage = null;
    let totalSubjectsWithGrades = 0;
    
    if (sectionInfo) {
      const gradesCollection = db.collection('grades');
      
      // Get all verified grades for the student in current section and current school year
      const studentGrades = await gradesCollection.find({
        student_id: new ObjectId(studentId),
        section_id: sectionInfo.section_id,
        school_year: currentSchoolYear, // Use current school year from admin settings
        'averages.final_grade': { $exists: true, $ne: null },
        verified: true
      }).toArray();

      if (studentGrades.length > 0) {
        const totalGrades = studentGrades.reduce((sum, grade) => {
          return sum + (grade.averages?.final_grade || 0);
        }, 0);
        
        generalAverage = Math.round((totalGrades / studentGrades.length) * 100) / 100;
        totalSubjectsWithGrades = studentGrades.length;
      }
    }

    // Calculate class rank
    let classRank = null;
    let totalStudentsInSection = 0;
    
    if (sectionInfo && generalAverage !== null) {
      const gradesCollection = db.collection('grades');
      
      // Get all students in the same section with their averages
      const allStudentsInSection = await sectionStudents.find({
        section_id: sectionInfo.section_id,
        status: 'active'
      }).toArray();

      const studentAverages = [];
      
      for (const student of allStudentsInSection) {
        const studentGrades = await gradesCollection.find({
          student_id: student.student_id,
          section_id: sectionInfo.section_id,
          school_year: currentSchoolYear, // Use current school year from admin settings
          'averages.final_grade': { $exists: true, $ne: null },
          verified: true
        }).toArray();

        if (studentGrades.length > 0) {
          const totalGrades = studentGrades.reduce((sum, grade) => {
            return sum + (grade.averages?.final_grade || 0);
          }, 0);
          
          const average = totalGrades / studentGrades.length;
          studentAverages.push({
            student_id: student.student_id.toString(),
            average_grade: average
          });
        }
      }

      // Sort by average grade (descending) and find rank
      studentAverages.sort((a, b) => b.average_grade - a.average_grade);
      
      const studentRankIndex = studentAverages.findIndex(s => s.student_id === studentId);
      if (studentRankIndex !== -1) {
        classRank = studentRankIndex + 1;
        totalStudentsInSection = studentAverages.length;
      }
    }

    // Get total students in section (including those without grades)
    if (sectionInfo && totalStudentsInSection === 0) {
      totalStudentsInSection = await sectionStudents.countDocuments({
        section_id: sectionInfo.section_id,
        status: 'active'
      });
    }

    // Format response
    const profileData = {
      section: sectionInfo ? {
        id: sectionInfo.section_id.toString(),
        name: sectionInfo.section_name,
        gradeLevel: sectionInfo.grade_level,
        adviser: sectionInfo.adviser_name || 'Not assigned'
      } : {
        id: null,
        name: 'No section assigned',
        gradeLevel: studentGradeLevel,
        adviser: 'No adviser'
      },
      subjects: subjects,
      academicSummary: {
        generalAverage: generalAverage,
        classRank: classRank || 'N/A',
        totalStudentsInSection: totalStudentsInSection || 0,
        totalSubjectsEnrolled: subjects.length,
        totalSubjectsWithGrades: totalSubjectsWithGrades
      }
    };

    return json({ 
      success: true, 
      data: profileData 
    });

  } catch (error) {
    console.error('Error fetching student profile data:', error);
    
    // Database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    return json({ error: 'Failed to fetch student profile data' }, { status: 500 });
  }
}

// Helper function to assign colors to subjects for UI
function getSubjectColor(subjectName) {
  // Enhanced color palette with more variety and better visual appeal
  const subjectColors = {
    'Mathematics': ['#4F46E5', '#6366F1', '#8B5CF6', '#3B82F6'], // Blues and purples
    'Math': ['#4F46E5', '#6366F1', '#8B5CF6', '#3B82F6'],
    'Science': ['#059669', '#10B981', '#34D399', '#047857'], // Greens
    'English': ['#DC2626', '#EF4444', '#F87171', '#B91C1C'], // Reds
    'Physical Education': ['#EA580C', '#F97316', '#FB923C', '#C2410C'], // Oranges
    'MAPEH': ['#EA580C', '#F97316', '#FB923C', '#C2410C'], // Oranges
    'PE': ['#EA580C', '#F97316', '#FB923C', '#C2410C'],
    'Filipino': ['#7C2D12', '#A16207', '#D97706', '#92400E'], // Browns and ambers
    'Araling Panlipunan': ['#B45309', '#D97706', '#F59E0B', '#A16207'], // Ambers
    'History': ['#B45309', '#D97706', '#F59E0B', '#A16207'],
    'Computer': ['#6366F1', '#8B5CF6', '#A855F7', '#7C3AED'], // Purples
    'Technology': ['#6366F1', '#8B5CF6', '#A855F7', '#7C3AED'],
    'Arts': ['#C026D3', '#D946EF', '#E879F9', '#A21CAF'], // Magentas
    'Music': ['#EC4899', '#F472B6', '#F9A8D4', '#DB2777'], // Pinks
    'Health': ['#16A34A', '#22C55E', '#4ADE80', '#15803D'], // Light greens
    'Values': ['#0891B2', '#06B6D4', '#22D3EE', '#0E7490'], // Cyans
    'Research': ['#7C2D12', '#A16207', '#D97706', '#92400E'], // Browns
    'TLE': ['#9333EA', '#A855F7', '#C084FC', '#7E22CE'], // Violets
    'ESP': ['#0891B2', '#06B6D4', '#22D3EE', '#0E7490'] // Cyans
  };

  // Additional vibrant colors for subjects not in the main list
  const fallbackColors = [
    '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', 
    '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
    '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
    '#F43F5E', '#E11D48', '#BE123C', '#9F1239', '#881337'
  ];
  
  // Simple hash function to generate consistent randomization based on subject name
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Normalize subject name for matching
  const normalizedName = subjectName.toLowerCase().trim();
  
  // Find matching color array based on subject name
  for (const [key, colorArray] of Object.entries(subjectColors)) {
    if (normalizedName.includes(key.toLowerCase())) {
      // Use hash to pick a consistent but "random" color from the array
      const hash = simpleHash(subjectName);
      const colorIndex = hash % colorArray.length;
      return colorArray[colorIndex];
    }
  }
  
  // If no specific match found, use fallback colors with randomization
  const hash = simpleHash(subjectName);
  const colorIndex = hash % fallbackColors.length;
  return fallbackColors[colorIndex];
}