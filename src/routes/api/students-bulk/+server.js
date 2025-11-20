import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { verifyAuth } from '../helper/auth-helper.js';
import { ObjectId } from 'mongodb';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, request }) {
  try {
    // Verify authentication - admins, teachers, and advisers can view student bulk data
    const authResult = await verifyAuth(request, ['admin', 'teacher', 'adviser']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const db = await connectToDatabase();
    
    // Get current school year from admin settings
    const schoolYearSetting = await db.collection('admin_settings').findOne({ 
      setting_key: 'current_school_year' 
    });
    const school_year = url.searchParams.get('school_year') || schoolYearSetting?.setting_value || '2025-2026';
    
    // Determine current quarter based on system date and quarter settings
    let currentQuarter = 1; // Default fallback
    
    if (!url.searchParams.has('quarter')) {
      // Only auto-detect if quarter is not explicitly provided
      try {
        const quarterSettings = await db.collection('admin_settings').find({
          setting_key: { 
            $in: [
              'quarter_1_start_date', 'quarter_1_end_date',
              'quarter_2_start_date', 'quarter_2_end_date',
              'quarter_3_start_date', 'quarter_3_end_date',
              'quarter_4_start_date', 'quarter_4_end_date'
            ]
          }
        }).toArray();

        const settings = {};
        quarterSettings.forEach(row => {
          settings[row.setting_key] = row.setting_value;
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Helper function to parse MM-DD-YYYY format
        const parseDate = (dateStr) => {
          if (!dateStr || dateStr.trim() === '') return null;
          const parts = dateStr.split('-');
          if (parts.length !== 3) return null;
          const [month, day, year] = parts.map(p => parseInt(p, 10));
          if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
          return new Date(year, month - 1, day);
        };

        // Check each quarter to find the current one
        const quarters = [
          { num: 1, start: parseDate(settings.quarter_1_start_date), end: parseDate(settings.quarter_1_end_date) },
          { num: 2, start: parseDate(settings.quarter_2_start_date), end: parseDate(settings.quarter_2_end_date) },
          { num: 3, start: parseDate(settings.quarter_3_start_date), end: parseDate(settings.quarter_3_end_date) },
          { num: 4, start: parseDate(settings.quarter_4_start_date), end: parseDate(settings.quarter_4_end_date) }
        ];

        for (const quarter of quarters) {
          if (quarter.start && quarter.end && today >= quarter.start && today <= quarter.end) {
            currentQuarter = quarter.num;
            break;
          }
        }
      } catch (error) {
        console.error('Error determining current quarter:', error);
        // Fall back to default quarter 1
      }
    }
    
    const quarter = parseInt(url.searchParams.get('quarter')) || currentQuarter;

    // Get all active students
    const activeStudents = await db.collection('users').find({
      account_type: 'student',
      status: 'active'
    }).toArray();

    if (activeStudents.length === 0) {
      return json({
        success: true,
        students: [],
        message: 'No active students found'
      });
    }

    // Get all active section enrollments for these students
    const studentIds = activeStudents.map(student => student._id);
    const sectionEnrollments = await db.collection('section_students').find({
      student_id: { $in: studentIds },
      status: 'active'
    }).toArray();

    // Create a map of student_id to section_id
    const studentSectionMap = {};
    sectionEnrollments.forEach(enrollment => {
      studentSectionMap[enrollment.student_id.toString()] = enrollment.section_id;
    });

    // Get all sections for enrolled students
    const sectionIds = [...new Set(Object.values(studentSectionMap))];
    const sections = await db.collection('sections').find({
      _id: { $in: sectionIds },
      status: 'active'
    }).toArray();

    // Create a map of section_id to section data
    const sectionMap = {};
    sections.forEach(section => {
      sectionMap[section._id.toString()] = section;
    });

    // Determine if we're calculating overall (all quarters) or specific quarter
    const calculateOverall = url.searchParams.get('quarter') === 'all';
    
    // Get grades based on whether we're calculating overall or specific quarter
    let gradesData;
    if (calculateOverall) {
      // Get all grades for all quarters
      gradesData = await db.collection('grades').find({
        student_id: { $in: studentIds },
        school_year: school_year,
        $or: [
          { verified: true },
          { 'verification.verified': true }
        ]
      }).toArray();
    } else {
      // Get grades for specific quarter
      gradesData = await db.collection('grades').find({
        student_id: { $in: studentIds },
        school_year: school_year,
        quarter: quarter,
        $or: [
          { verified: true },
          { 'verification.verified': true }
        ]
      }).toArray();
    }

    // Create a map of student_id to their grades
    const studentGradesMap = {};
    gradesData.forEach(grade => {
      const studentId = grade.student_id.toString();
      if (!studentGradesMap[studentId]) {
        studentGradesMap[studentId] = [];
      }
      studentGradesMap[studentId].push(grade);
    });

    // Calculate GWA for each student and format the response - INCLUDE ALL STUDENTS
    const studentsWithGrades = activeStudents
      .map(student => {
        const studentId = student._id.toString();
        const sectionId = studentSectionMap[studentId];
        const section = sectionId && sectionMap[sectionId.toString()];
        const studentGrades = studentGradesMap[studentId] || [];
        
        // Calculate GWA based on mode (overall or specific quarter)
        let gwa = 0;
        if (calculateOverall) {
          // Calculate overall GWA across all quarters
          // Group grades by quarter and subject, then calculate quarter averages, then overall average
          const quarterAverages = {};
          
          studentGrades.forEach(grade => {
            const quarter = grade.quarter;
            if (!quarterAverages[quarter]) {
              quarterAverages[quarter] = [];
            }
            if (grade.averages && grade.averages.final_grade && grade.averages.final_grade > 0) {
              quarterAverages[quarter].push(grade.averages.final_grade);
            }
          });
          
          // Calculate average for each quarter
          const quarterGWAs = [];
          Object.keys(quarterAverages).forEach(quarter => {
            const grades = quarterAverages[quarter];
            if (grades.length > 0) {
              const quarterGWA = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
              quarterGWAs.push(quarterGWA);
            }
          });
          
          // Calculate overall average from quarter GWAs
          if (quarterGWAs.length > 0) {
            gwa = quarterGWAs.reduce((sum, qGWA) => sum + qGWA, 0) / quarterGWAs.length;
          }
        } else {
          // Calculate GWA for specific quarter (original logic)
          if (studentGrades.length > 0) {
            const validGrades = studentGrades.filter(grade => 
              grade.averages && grade.averages.final_grade && grade.averages.final_grade > 0
            );
            
            if (validGrades.length > 0) {
              const totalGrades = validGrades.reduce((sum, grade) => 
                sum + grade.averages.final_grade, 0
              );
              gwa = totalGrades / validGrades.length;
            }
          }
        }

        // Format GWA - remove .0 for whole numbers
        const formattedGwa = Math.round(gwa * 10) / 10;
        const gwaDisplay = formattedGwa === Math.floor(formattedGwa) ? Math.floor(formattedGwa) : Number(formattedGwa.toFixed(1));

        return {
          id: student.account_number,
          _id: student._id.toString(),
          name: student.full_name,
          email: student.email,
          gradeLevel: section ? section.grade_level.toString() : student.grade_level?.toString() || 'N/A',
          section: section ? section.name : 'No Section',
          gwa: gwaDisplay,
          totalSubjects: studentGrades.length,
          verifiedGrades: studentGrades.filter(grade => 
            (grade.verified === true || grade.verification?.verified === true)
          ).length
        };
      })
      .sort((a, b) => {
        // Sort by account number (ID) - extract numeric part for proper ordering
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
        quarter: calculateOverall ? 'all' : quarter,
        quarterDisplay: calculateOverall ? 'Overall (All Quarters)' : `Quarter ${quarter}`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching students bulk data:', error);
    return json({
      success: false,
      error: 'Failed to fetch students data',
      students: []
    }, { status: 500 });
  }
}