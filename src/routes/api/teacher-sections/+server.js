import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { verifyAuth } from '../helper/auth-helper.js';
import { ObjectId } from 'mongodb';

export async function GET({ url, request }) {
    try {
        // Verify authentication - only teachers and admins can access
        const authResult = await verifyAuth(request, ['teacher', 'admin']);
        if (!authResult.success) {
            return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
        }

        const user = authResult.user;
        const teacherId = url.searchParams.get('teacherId') || user.id;

        // Teachers can only view their own sections, admins can view any
        if (user.account_type === 'teacher' && String(user.id) !== String(teacherId)) {
            return json({ error: 'Access denied. You can only view your own sections.' }, { status: 403 });
        }

        if (!teacherId) {
            return json({ 
                success: false, 
                error: 'Teacher ID is required' 
            }, { status: 400 });
        }

        const db = await connectToDatabase();

        // Get current school year from admin settings
        const schoolYearSetting = await db.collection('admin_settings').findOne({ 
            setting_key: 'current_school_year' 
        });
        const schoolYear = url.searchParams.get('schoolYear') || schoolYearSetting?.setting_value || '2025-2026';

        // MongoDB aggregation pipeline to get sections that the teacher is teaching
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
                    from: 'sections',
                    localField: 'section_id',
                    foreignField: '_id',
                    as: 'section'
                }
            },
            // Unwind section array
            {
                $unwind: '$section'
            },
            // Match only active sections
            {
                $match: {
                    'section.status': 'active'
                }
            },
            // Lookup subject details
            {
                $lookup: {
                    from: 'subjects',
                    localField: 'subject_id',
                    foreignField: '_id',
                    as: 'subject'
                }
            },
            // Lookup section students
            {
                $lookup: {
                    from: 'section_students',
                    let: { sectionId: '$section._id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$section_id', '$$sectionId'] },
                                        { $eq: ['$status', 'active'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'students'
                }
            },
            // Group by section to aggregate data
            {
                $group: {
                    _id: '$section._id',
                    section_name: { $first: '$section.name' },
                    grade_level: { $first: '$section.grade_level' },
                    school_year: { $first: '$section.school_year' },
                    student_count: { $first: { $size: '$students' } },
                    subjects: { $addToSet: { $arrayElemAt: ['$subject.name', 0] } },
                    subject_count: { $addToSet: '$subject_id' }
                }
            },
            // Project final structure
            {
                $project: {
                    section_id: '$_id',
                    section_name: 1,
                    grade_level: 1,
                    school_year: 1,
                    student_count: 1,
                    subjects: { $filter: { input: '$subjects', cond: { $ne: ['$$this', null] } } },
                    subject_count: { $size: '$subject_count' }
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

        const result = await db.collection('schedules').aggregate(pipeline).toArray();

        // Group sections by grade level
        const sectionsByGrade = {};
        let totalSections = 0;
        let totalStudents = 0;

        result.forEach(row => {
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

        // Convert to array format expected by the frontend
        const classData = Object.values(sectionsByGrade);
        const yearLevels = Object.keys(sectionsByGrade).map(level => parseInt(level));

        // Calculate statistics
        const stats = {
            yearLevels: yearLevels,
            totalSections: totalSections,
            totalStudents: totalStudents,
            averagePerSection: totalSections > 0 ? Math.round(totalStudents / totalSections) : 0
        };

        return json({
            success: true,
            data: {
                classData: classData,
                stats: stats
            }
        });

    } catch (error) {
        console.error('Error fetching teacher sections:', error);
        return json({ 
            success: false, 
            error: 'Failed to fetch teacher sections' 
        }, { status: 500 });
    }
}