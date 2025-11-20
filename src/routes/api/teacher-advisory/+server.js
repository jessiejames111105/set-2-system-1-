import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { verifyAuth } from '../helper/auth-helper.js';
import { ObjectId } from 'mongodb';
import { createGradeVerificationNotification, createBulkGradeVerificationNotifications, formatTeacherName } from '../helper/notification-helper.js';

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

export async function GET({ request, url }) {
    try {
        // Verify authentication - only teachers and admins can access
        const authResult = await verifyAuth(request, ['teacher', 'admin']);
        if (!authResult.success) {
            return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
        }

        const user = authResult.user;
        const db = await connectToDatabase();
        
        // Get query parameters
        const teacherId = url.searchParams.get('teacher_id') || user.id;
        const schoolYear = url.searchParams.get('school_year') || await getCurrentSchoolYear(db);
        const quarter = parseInt(url.searchParams.get('quarter')) || 1;

        // Teachers can only view their own advisory section, admins can view any
        if (user.account_type === 'teacher' && String(user.id) !== String(teacherId)) {
            return json({ error: 'Access denied. You can only view your own advisory section.' }, { status: 403 });
        }

        if (!teacherId) {
            return json({ error: 'Teacher ID is required' }, { status: 400 });
        }

        // Validate ObjectId format
        if (!ObjectId.isValid(teacherId)) {
            return json({ error: 'Invalid teacher ID format' }, { status: 400 });
        }

        // Get the section where this teacher is the adviser
        const section = await db.collection('sections').findOne({
            adviser_id: new ObjectId(teacherId),
            status: 'active'
        });

        if (!section) {
            return json({
                success: true,
                data: {
                    advisoryData: null,
                    students: [],
                    message: 'No advisory section assigned'
                }
            });
        }

        // Get students in the advisory section
        const sectionStudents = await db.collection('section_students').find({
            section_id: section._id,
            status: 'active'
        }).toArray();

        const studentIds = sectionStudents.map(ss => ss.student_id);

        // Get student details
        const students = await db.collection('users').find({
            _id: { $in: studentIds },
            account_type: 'student',
            status: 'active'
        }).sort({ full_name: 1 }).toArray();

        // Get all grades for these students in this section
        let gradesData = [];
        if (studentIds.length > 0) {
            gradesData = await db.collection('grades').find({
                student_id: { $in: studentIds },
                section_id: section._id,
                school_year: schoolYear,
                quarter,
                submitted_to_adviser: true // Only get grades that have been submitted to adviser
            }).toArray();
        }

        // Get subjects for this section with teacher information
        // Use section's school year for schedules (historical data)
        const scheduleQuery = {
            section_id: section._id
        };
        
        // Only add school_year filter if it exists on the section
        if (section.school_year) {
            scheduleQuery.school_year = section.school_year;
        }
        
        const schedules = await db.collection('schedules').find(scheduleQuery).toArray();
        
        // Handle case where no schedules are found
        const subjectIds = schedules.length > 0 ? [...new Set(schedules.map(s => s.subject_id).filter(id => id))] : [];
        
        const subjects = subjectIds.length > 0 ? await db.collection('subjects').find({
            _id: { $in: subjectIds }
        }).toArray() : [];

        // Get teacher information for each subject
        const teacherIds = schedules.length > 0 ? [...new Set(schedules.map(s => s.teacher_id).filter(id => id))] : [];
        const teachers = teacherIds.length > 0 ? await db.collection('users').find({
            _id: { $in: teacherIds },
            account_type: 'teacher'
        }).toArray() : [];

        // Create a map of subject to teacher
        const subjectTeacherMap = {};
        schedules.forEach(schedule => {
            if (schedule.teacher_id && schedule.subject_id) {
                const teacher = teachers.find(t => t._id && t._id.toString() === schedule.teacher_id.toString());
                if (teacher) {
                    subjectTeacherMap[schedule.subject_id.toString()] = teacher.full_name;
                }
            }
        });

        // Process students with their grades
        const studentsWithGrades = students.map(student => {
            const studentGrades = gradesData.filter(g => 
                g.student_id && student._id && g.student_id.toString() === student._id.toString()
            );

            // Group grades by subject
            const subjectGrades = subjects.map(subject => {
                const subjectGrade = studentGrades.find(g => 
                    g.subject_id && subject._id && g.subject_id.toString() === subject._id.toString()
                );
                
                // Check if grades have been submitted to adviser
                const isSubmittedToAdviser = subjectGrade?.submitted_to_adviser || false;

                return {
                    subject_id: subject._id,
                    subject_name: subject.name,
                    subject_code: subject.code,
                    teacher_name: subjectTeacherMap[subject._id.toString()] || 'Unknown Teacher',
                    averages: isSubmittedToAdviser ? (subjectGrade?.averages || {
                        written_work: 0,
                        performance_tasks: 0,
                        quarterly_assessment: 0,
                        final_grade: 0
                    }) : {
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

            // Calculate overall average
            const validFinalGrades = subjectGrades
                .map(sg => sg.averages.final_grade)
                .filter(grade => grade !== null && grade > 0);
            
            const overallAverage = validFinalGrades.length > 0
                ? Math.round((validFinalGrades.reduce((sum, grade) => sum + grade, 0) / validFinalGrades.length) * 100) / 100
                : null;

            // Check if all grades are verified
            const allGradesVerified = subjectGrades.length > 0 && subjectGrades.every(sg => sg.verified);

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

        // Calculate class statistics
        const validAverages = studentsWithGrades
            .map(s => s.overall_average)
            .filter(avg => avg !== null && avg > 0);
        
        const classAverage = validAverages.length > 0 
            ? Math.round((validAverages.reduce((sum, avg) => sum + avg, 0) / validAverages.length) * 100) / 100
            : null;

        // Get room information
        let room = null;
        if (section.room_id) {
            const roomId = ObjectId.isValid(section.room_id) ? new ObjectId(section.room_id) : section.room_id;
            room = await db.collection('rooms').findOne({ _id: roomId });
        }

        // Get teacher information
        const teacher = await db.collection('users').findOne({
            _id: new ObjectId(teacherId),
            account_type: 'teacher'
        });

        const advisoryData = {
            section_id: section._id,
            sectionName: section.name,
            gradeLevel: section.grade_level,
            schoolYear: section.school_year || schoolYear, // Fallback to query school year if section doesn't have one
            roomName: room ? room.name : 'No room assigned',
            building: room?.building || '',
            floor: room?.floor || '',
            totalStudents: students.length,
            averageGrade: classAverage,
            subjectsCount: subjects.length,
            quarter: quarter,
            teacherName: teacher ? teacher.full_name : 'Unknown Teacher',
            submittedDate: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
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
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
}

export async function POST({ request }) {
    try {
        const db = await connectToDatabase();
        const body = await request.json();
        const { action } = body;

        // Verify grades for a student
        if (action === 'verify_student_grades') {
            const {
                student_id,
                section_id,
                teacher_id,
                quarter = 1,
                verified = true
            } = body;

            // Use current school year from admin settings if not provided
            const school_year = body.school_year || await getCurrentSchoolYear(db);

            if (!student_id || !section_id || !teacher_id) {
                return json({ error: 'Missing required fields' }, { status: 400 });
            }

            // Get teacher information for notification
            const teacher = await db.collection('users').findOne({
                _id: new ObjectId(teacher_id)
            }, { projection: { full_name: 1, gender: 1 } });

            const teacherName = teacher ? formatTeacherName(teacher.full_name, teacher.gender) : 'Your teacher';

            // Update all grades for this student in this section
            const result = await db.collection('grades').updateMany(
                {
                    student_id: new ObjectId(student_id),
                    section_id: new ObjectId(section_id),
                    school_year,
                    quarter
                },
                {
                    $set: {
                        verified: verified,
                        verified_at: verified ? new Date() : null,
                        verified_by: verified ? new ObjectId(teacher_id) : null,
                        updated_at: new Date()
                    }
                }
            );

            // Create individual notifications for each subject when verifying
            if (verified && result.modifiedCount > 0) {
                // Get all subjects for this student that were verified
                const verifiedGrades = await db.collection('grades').find({
                    student_id: new ObjectId(student_id),
                    section_id: new ObjectId(section_id),
                    school_year,
                    quarter,
                    verified: true
                }).toArray();

                // Get subject names for notifications
                const subjectIds = verifiedGrades.map(grade => grade.subject_id);
                const subjects = await db.collection('subjects').find({
                    _id: { $in: subjectIds }
                }).toArray();

                // Create a notification for each subject
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
                message: verified ? 'Student grades verified successfully' : 'Student grades unverified successfully',
                modified_count: result.modifiedCount
            });
        }

        // Verify all grades for the section
        if (action === 'verify_all_grades') {
            const {
                section_id,
                teacher_id,
                quarter = 1,
                verified = true
            } = body;

            // Use current school year from admin settings if not provided
            const school_year = body.school_year || await getCurrentSchoolYear(db);

            if (!section_id || !teacher_id) {
                return json({ error: 'Missing required fields' }, { status: 400 });
            }

            // Get teacher information for notification
            const teacher = await db.collection('users').findOne({
                _id: new ObjectId(teacher_id)
            }, { projection: { full_name: 1, gender: 1 } });

            const teacherName = teacher ? formatTeacherName(teacher.full_name, teacher.gender) : 'Your teacher';

            // Get all students in this section for notifications
            const studentsInSection = await db.collection('grades').distinct('student_id', {
                section_id: new ObjectId(section_id),
                school_year,
                quarter
            });

            // Update all grades for this section
            const result = await db.collection('grades').updateMany(
                {
                    section_id: new ObjectId(section_id),
                    school_year,
                    quarter
                },
                {
                    $set: {
                        verified: verified,
                        verified_at: verified ? new Date() : null,
                        verified_by: verified ? new ObjectId(teacher_id) : null,
                        updated_at: new Date()
                    }
                }
            );

            // Create individual notifications for each subject when verifying all grades
            if (verified && result.modifiedCount > 0 && studentsInSection.length > 0) {
                // Get all unique subjects that were verified in this section
                const verifiedGrades = await db.collection('grades').find({
                    section_id: new ObjectId(section_id),
                    school_year,
                    quarter,
                    verified: true
                }).toArray();

                const uniqueSubjectIds = [...new Set(verifiedGrades.map(grade => grade.subject_id.toString()))];
                const subjects = await db.collection('subjects').find({
                    _id: { $in: uniqueSubjectIds.map(id => new ObjectId(id)) }
                }).toArray();

                // Create notifications for each subject for each student
                for (const subject of subjects) {
                    await createBulkGradeVerificationNotifications(
                        db,
                        studentsInSection.map(id => id.toString()),
                        teacherName,
                        subject.name
                    );
                }
            }

            return json({
                success: true,
                message: verified ? 'All grades verified successfully' : 'All grades unverified successfully',
                modified_count: result.modifiedCount
            });
        }

        return json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Error in teacher-advisory POST:', error);
        return json({ 
            success: false, 
            error: 'Internal server error' 
        }, { status: 500 });
    }
}