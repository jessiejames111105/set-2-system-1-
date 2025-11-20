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

// GET /api/teacher-profile - Get comprehensive teacher profile data
export async function GET({ url, request }) {
  try {
    // Verify authentication - teachers can view their own profile
    const authResult = await verifyAuth(request, ['teacher', 'admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }

    const user = authResult.user;
    const teacherId = url.searchParams.get('teacherId');
    
    if (!teacherId) {
      return json({ error: 'Teacher ID is required' }, { status: 400 });
    }

    // Teachers can only view their own profile, admins can view any
    if (user.account_type === 'teacher' && String(user.id) !== String(teacherId)) {
      return json({ error: 'Access denied. You can only view your own profile.' }, { status: 403 });
    }

    const db = await connectToDatabase();
    
    // Get current school year from admin settings
    const currentSchoolYear = await getCurrentSchoolYear(db);

    // Get teacher information
    const users = db.collection('users');
    const teacher = await users.findOne({
      _id: new ObjectId(teacherId),
      account_type: 'teacher'
    });

    if (!teacher) {
      return json({ error: 'Teacher not found' }, { status: 404 });
    }

    // Get teacher's sections and subjects
    const schedulesCollection = db.collection('schedules');
    const sectionsCollection = db.collection('sections');
    const subjectsCollection = db.collection('subjects');
    const sectionStudentsCollection = db.collection('section_students');

    // Find all schedules for this teacher in the current school year
    const teacherSchedules = await schedulesCollection.find({
      teacher_id: new ObjectId(teacherId),
      school_year: currentSchoolYear
    }).toArray();

    // Group schedules by section and collect unique subjects
    const sectionsMap = new Map();
    const subjectsMap = new Map();
    
    for (const schedule of teacherSchedules) {
      const sectionId = schedule.section_id.toString();
      const subjectId = schedule.subject_id.toString();
      
      if (!sectionsMap.has(sectionId)) {
        // Get section details
        const section = await sectionsCollection.findOne({
          _id: schedule.section_id
        });
        
        if (section) {
          // Count students in this section
          const studentCount = await sectionStudentsCollection.countDocuments({
            section_id: schedule.section_id,
            status: 'active'
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

      // Get subject details and add to both section and subjects map
      const subject = await subjectsCollection.findOne({
        _id: schedule.subject_id
      });

      if (subject) {
        // Add subject to section
        if (sectionsMap.has(sectionId)) {
          const sectionData = sectionsMap.get(sectionId);
          // Check if subject is already added to this section
          const existingSubject = sectionData.subjects.find(s => s.id === subjectId);
          if (!existingSubject) {
            sectionData.subjects.push({
              id: subject._id.toString(),
              name: subject.name,
              code: subject.code
            });
          }
        }

        // Add subject to unique subjects map
        if (!subjectsMap.has(subjectId)) {
          // Count how many sections this teacher teaches this subject in
          const subjectSections = teacherSchedules.filter(s => s.subject_id.toString() === subjectId);
          const uniqueSectionIds = [...new Set(subjectSections.map(s => s.section_id.toString()))];
          
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

    // Convert maps to arrays
    const sections = Array.from(sectionsMap.values());
    const subjects = Array.from(subjectsMap.values());

    // Get teacher's advisory section (if any)
    let advisorySection = null;
    const advisoryData = await sectionsCollection.findOne({
      adviser_id: new ObjectId(teacherId),
      school_year: currentSchoolYear
    });

    if (advisoryData) {
      const advisoryStudentCount = await sectionStudentsCollection.countDocuments({
        section_id: advisoryData._id,
        status: 'active'
      });

      advisorySection = {
        id: advisoryData._id.toString(),
        name: advisoryData.name,
        grade_level: advisoryData.grade_level,
        school_year: advisoryData.school_year,
        student_count: advisoryStudentCount
      };
    }

    // Prepare response data
    const profileData = {
      teacher: {
        id: teacher._id.toString(),
        full_name: teacher.full_name,
        email: teacher.email,
        position: teacher.position || 'Teacher',
        department: teacher.department || 'General'
      },
      sections: sections,
      subjects: subjects,
      advisory_section: advisorySection,
      current_school_year: currentSchoolYear,
      total_sections: sections.length,
      total_subjects: subjects.length,
      total_students: sections.reduce((sum, section) => sum + section.student_count, 0)
    };

    return json({ success: true, data: profileData });

  } catch (error) {
    console.error('Error fetching teacher profile:', error);
    return json({ 
      error: 'Failed to fetch teacher profile data',
      details: error.message 
    }, { status: 500 });
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
