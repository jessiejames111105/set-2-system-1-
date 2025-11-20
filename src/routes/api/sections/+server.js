import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { getUserFromRequest, logActivityWithUser, verifyAuth } from '../helper/auth-helper.js';
import { ObjectId } from 'mongodb';

// GET - Fetch sections, available teachers, and available students
export async function GET({ url, request }) {
    try {
        // Verify authentication - admins, teachers, and advisers can view sections
        const authResult = await verifyAuth(request, ['admin', 'teacher', 'adviser']);
        if (!authResult.success) {
            return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
        }
        
        const db = await connectToDatabase();
        const action = url.searchParams.get('action');
        const gradeLevel = url.searchParams.get('gradeLevel');
        
        // Get current school year from admin settings
        const schoolYearSetting = await db.collection('admin_settings').findOne({ 
            setting_key: 'current_school_year' 
        });
        const schoolYear = url.searchParams.get('schoolYear') || schoolYearSetting?.setting_value || '2025-2026';
        const sectionId = url.searchParams.get('sectionId');

        switch (action) {
            case 'available-sections':
                const sections = await db.collection('sections').find({
                    status: 'active'
                }).sort({ grade_level: 1, name: 1 }).toArray();
                
                return json({ success: true, data: sections });

            case 'available-rooms':
                const rooms = await db.collection('rooms').aggregate([
                    {
                        $lookup: {
                            from: 'sections',
                            localField: '_id',
                            foreignField: 'room_id',
                            as: 'assigned_sections',
                            pipeline: [{ $match: { status: 'active' } }]
                        }
                    },
                    {
                        $addFields: {
                            available: { $eq: [{ $size: '$assigned_sections' }, 0] }
                        }
                    },
                    {
                        $project: {
                            id: '$_id',
                            name: 1,
                            building: 1,
                            floor: 1,
                            status: 1,
                            available: 1
                        }
                    },
                    {
                        $sort: { building: 1, floor: 1, name: 1 }
                    }
                ]).toArray();
                
                return json({ success: true, data: rooms });

            case 'available-teachers':
                const teacherGradeLevel = url.searchParams.get('teacherGradeLevel');
                
                // Get teachers who are not already assigned as advisers for the given grade level and school year
                const availableTeachers = await db.collection('users').aggregate([
                    {
                        $match: {
                            account_type: 'teacher',
                            status: 'active'
                        }
                    },
                    {
                        $lookup: {
                            from: 'sections',
                            localField: '_id',
                            foreignField: 'adviser_id',
                            as: 'advised_sections',
                            pipeline: [
                                {
                                    $match: {
                                        status: 'active',
                                        school_year: schoolYear,
                                        ...(teacherGradeLevel && { grade_level: parseInt(teacherGradeLevel) })
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $match: {
                            advised_sections: { $size: 0 }
                        }
                    },
                    {
                        $project: {
                            id: '$_id',
                            account_number: 1,
                            first_name: 1,
                            last_name: 1,
                            full_name: 1,
                            email: 1
                        }
                    }
                ]).toArray();
                
                return json({ success: true, data: availableTeachers });

            case 'available-students':
                if (!gradeLevel) {
                    return json({ success: false, error: 'Grade level is required' }, { status: 400 });
                }
                
                // Get students who are not enrolled in any active section for the given grade level and school year
                const availableStudents = await db.collection('users').aggregate([
                    {
                        $match: {
                            account_type: 'student',
                            status: 'active',
                            grade_level: gradeLevel.toString()
                        }
                    },
                    {
                        $lookup: {
                            from: 'section_students',
                            localField: '_id',
                            foreignField: 'student_id',
                            as: 'enrollments',
                            pipeline: [
                                {
                                    $lookup: {
                                        from: 'sections',
                                        localField: 'section_id',
                                        foreignField: '_id',
                                        as: 'section'
                                    }
                                },
                                {
                                    $match: {
                                        status: 'active',
                                        'section.status': 'active',
                                        'section.school_year': schoolYear
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $match: {
                            enrollments: { $size: 0 }
                        }
                    },
                    {
                        $project: {
                            id: '$_id',
                            account_number: 1,
                            first_name: 1,
                            last_name: 1,
                            full_name: 1,
                            email: 1,
                            grade_level: 1,
                            age: 1,
                            guardian: 1
                        }
                    }
                ]).toArray();
                
                return json({ success: true, data: availableStudents });

            case 'section-details':
                if (!sectionId) {
                    return json({ success: false, error: 'Section ID is required' }, { status: 400 });
                }
                
                const sectionDetails = await db.collection('sections').aggregate([
                    {
                        $match: { _id: new ObjectId(sectionId) }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'adviser_id',
                            foreignField: '_id',
                            as: 'adviser'
                        }
                    },
                    {
                        $lookup: {
                            from: 'rooms',
                            localField: 'room_id',
                            foreignField: '_id',
                            as: 'room'
                        }
                    },
                    {
                        $lookup: {
                            from: 'section_students',
                            localField: '_id',
                            foreignField: 'section_id',
                            as: 'students',
                            pipeline: [
                                { $match: { status: 'active' } },
                                {
                                    $lookup: {
                                        from: 'users',
                                        localField: 'student_id',
                                        foreignField: '_id',
                                        as: 'student_info'
                                    }
                                },
                                { $unwind: '$student_info' }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            id: '$_id',
                            adviser_name: { $arrayElemAt: ['$adviser.full_name', 0] },
                            room_name: { $arrayElemAt: ['$room.name', 0] },
                            student_count: { $size: '$students' }
                        }
                    }
                ]).toArray();
                
                return json({ success: true, data: sectionDetails[0] || null });

            case 'section-students':
                if (!sectionId) {
                    return json({ success: false, error: 'Section ID is required' }, { status: 400 });
                }
                
                const sectionStudents = await db.collection('section_students').aggregate([
                    {
                        $match: { 
                            section_id: new ObjectId(sectionId),
                            status: 'active'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'student_id',
                            foreignField: '_id',
                            as: 'student'
                        }
                    },
                    {
                        $unwind: '$student'
                    },
                    {
                        $project: {
                            id: '$student._id',
                            account_number: '$student.account_number',
                            first_name: '$student.first_name',
                            last_name: '$student.last_name',
                            full_name: '$student.full_name',
                            email: '$student.email',
                            grade_level: '$student.grade_level',
                            age: '$student.age',
                            guardian: '$student.guardian',
                            enrolled_at: '$enrolled_at',
                            enrollment_status: '$status'
                        }
                    },
                    {
                        $sort: { full_name: 1 }
                    }
                ]).toArray();
                
                return json({ success: true, data: sectionStudents });

            default:
                // Default: Get all sections with details, with optional search functionality
                const searchTerm = url.searchParams.get('search');
                
                let pipeline = [
                    {
                        $match: { 
                            school_year: schoolYear,
                            status: 'active'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'adviser_id',
                            foreignField: '_id',
                            as: 'adviser'
                        }
                    },
                    {
                        $lookup: {
                            from: 'rooms',
                            localField: 'room_id',
                            foreignField: '_id',
                            as: 'room'
                        }
                    },
                    {
                        $lookup: {
                            from: 'section_students',
                            localField: '_id',
                            foreignField: 'section_id',
                            as: 'students',
                            pipeline: [
                                { $match: { status: 'active' } },
                                {
                                    $lookup: {
                                        from: 'users',
                                        localField: 'student_id',
                                        foreignField: '_id',
                                        as: 'student_info'
                                    }
                                },
                                { $unwind: '$student_info' }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            id: '$_id',
                            adviser_name: { $arrayElemAt: ['$adviser.full_name', 0] },
                            adviser_account_number: { $arrayElemAt: ['$adviser.account_number', 0] },
                            room_name: { $arrayElemAt: ['$room.name', 0] },
                            room_building: { $arrayElemAt: ['$room.building', 0] },
                            room_floor: { $arrayElemAt: ['$room.floor', 0] },
                            student_count: { $size: '$students' }
                        }
                    }
                ];

                // Add search functionality if search term is provided
                if (searchTerm && searchTerm.trim()) {
                    const searchRegex = { $regex: searchTerm.trim(), $options: 'i' };
                    
                    pipeline.push({
                        $match: {
                            $or: [
                                // Search by section name
                                { name: searchRegex },
                                // Search by grade level (as string)
                                { grade_level: { $regex: searchTerm.trim(), $options: 'i' } },
                                // Search by adviser name
                                { adviser_name: searchRegex },
                                // Search by student account number or name
                                {
                                    'students.student_info.account_number': searchRegex
                                },
                                {
                                    'students.student_info.full_name': searchRegex
                                },
                                {
                                    'students.student_info.first_name': searchRegex
                                },
                                {
                                    'students.student_info.last_name': searchRegex
                                }
                            ]
                        }
                    });
                }

                pipeline.push({
                    $sort: { grade_level: 1, name: 1 }
                });

                const allSections = await db.collection('sections').aggregate(pipeline).toArray();
                
                return json({ success: true, data: allSections });
        }
    } catch (error) {
        console.error('Error fetching sections data:', error);
        return json({ success: false, error: 'Failed to fetch data' }, { status: 500 });
    }
}

// POST - Create new section
export async function POST({ request, getClientAddress }) {
    try {
        // Verify authentication - only admins can create sections
        const authResult = await verifyAuth(request, ['admin']);
        if (!authResult.success) {
            return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
        }
        const user = authResult.user;
        
        const db = await connectToDatabase();
        const requestBody = await request.json();
        const { 
            sectionName, 
            gradeLevel, 
            schoolYear, 
            adviserId: adviserId_raw, 
            studentIds, 
            roomId 
        } = requestBody;
        
        // Handle both adviserId and adviser_id for compatibility
        const adviserId = adviserId_raw || requestBody.adviser_id;
        const clientIP = getClientAddress();
        const userAgent = request.headers.get('user-agent');

        // Validate required fields
        if (!sectionName || !gradeLevel || !schoolYear) {
            return json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // Check if section name already exists for the same grade level and school year
        const existingSection = await db.collection('sections').findOne({
            name: sectionName,
            grade_level: parseInt(gradeLevel),
            school_year: schoolYear,
            status: 'active'
        });

        if (existingSection) {
            return json({ 
                success: false, 
                error: 'A section with this name already exists for the specified grade level and school year' 
            }, { status: 400 });
        }

        // Validate adviser if provided
        if (adviserId) {
            const adviser = await db.collection('users').findOne({
                _id: new ObjectId(adviserId),
                account_type: 'teacher',
                status: 'active'
            });

            if (!adviser) {
                return json({ 
                    success: false, 
                    error: 'Invalid adviser selected' 
                }, { status: 400 });
            }

            // Check if adviser is already assigned to another section
            const existingAdviserSection = await db.collection('sections').findOne({
                adviser_id: new ObjectId(adviserId),
                school_year: schoolYear,
                status: 'active'
            });

            if (existingAdviserSection) {
                return json({ 
                    success: false, 
                    error: 'This teacher is already assigned as an adviser to another section' 
                }, { status: 400 });
            }
        }

        // Validate room if provided
        if (roomId) {
            const room = await db.collection('rooms').findOne({
                _id: new ObjectId(roomId),
                status: 'active'
            });

            if (!room) {
                return json({ 
                    success: false, 
                    error: 'Invalid room selected' 
                }, { status: 400 });
            }

            // Check if room is already assigned
            const existingRoomSection = await db.collection('sections').findOne({
                room_id: new ObjectId(roomId),
                status: 'active'
            });

            if (existingRoomSection) {
                return json({ 
                    success: false, 
                    error: 'This room is already assigned to another section' 
                }, { status: 400 });
            }
        }

        // Create the section
        const sectionData = {
            name: sectionName,
            grade_level: parseInt(gradeLevel),
            school_year: schoolYear,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
        };

        if (adviserId) {
            sectionData.adviser_id = new ObjectId(adviserId);
        }

        if (roomId) {
            sectionData.room_id = new ObjectId(roomId);
        }

        const sectionResult = await db.collection('sections').insertOne(sectionData);
        const newSectionId = sectionResult.insertedId;

        // Add students to the section if provided
        if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
            // Validate all students exist and are available
            const students = await db.collection('users').find({
                _id: { $in: studentIds.map(id => new ObjectId(id)) },
                account_type: 'student',
                status: 'active',
                grade_level: gradeLevel.toString()
            }).toArray();

            if (students.length !== studentIds.length) {
                return json({ 
                    success: false, 
                    error: 'Some selected students are invalid or not available' 
                }, { status: 400 });
            }

            // Check if any students are already enrolled in active sections
            const existingEnrollments = await db.collection('section_students').find({
                student_id: { $in: studentIds.map(id => new ObjectId(id)) },
                status: 'active'
            }).toArray();

            if (existingEnrollments.length > 0) {
                return json({ 
                    success: false, 
                    error: 'Some students are already enrolled in other sections' 
                }, { status: 400 });
            }

            // Create section_students records
            const enrollmentData = studentIds.map(studentId => ({
                section_id: newSectionId,
                student_id: new ObjectId(studentId),
                enrolled_at: new Date(),
                status: 'active'
            }));

            await db.collection('section_students').insertMany(enrollmentData);
        }

        // Log activity
        try {
            const activityCollection = db.collection('activity_logs');
            
            // Create activity log with proper structure
            await activityCollection.insertOne({
                activity_type: 'section_created',
                user_id: user?.id ? new ObjectId(user.id) : null,
                user_account_number: user?.account_number || null,
                activity_data: {
                    section_name: sectionName,
                    grade_level: parseInt(gradeLevel),
                    school_year: schoolYear,
                    student_count: studentIds ? studentIds.length : 0
                },
                ip_address: clientIP,
                user_agent: userAgent,
                created_at: new Date()
            });

            // Log adviser assignment if an adviser was assigned during creation
            if (adviserId) {
                const adviser = await db.collection('users').findOne({
                    _id: new ObjectId(adviserId)
                });
                
                if (adviser) {
                    await activityCollection.insertOne({
                        activity_type: 'adviser_assigned_to_section',
                        user_id: user?.id ? new ObjectId(user.id) : null,
                        user_account_number: user?.account_number || null,
                        activity_data: {
                            section_name: sectionName,
                            grade_level: parseInt(gradeLevel),
                            adviser: {
                                name: adviser.full_name,
                                account_number: adviser.account_number
                            }
                        },
                        ip_address: clientIP,
                        user_agent: userAgent,
                        created_at: new Date()
                    });
                }
            }

            // Log individual student enrollments
            if (studentIds && studentIds.length > 0) {
                for (const studentId of studentIds) {
                    // Get student details for logging
                    const student = await db.collection('users').findOne({ _id: new ObjectId(studentId) });
                    
                    await activityCollection.insertOne({
                        activity_type: 'student_enrolled_to_section',
                        user_id: user?.id ? new ObjectId(user.id) : null,
                        user_account_number: user?.account_number || null,
                        activity_data: {
                            section_name: sectionName,
                            student: {
                                name: student?.full_name,
                                account_number: student?.account_number
                            }
                        },
                        ip_address: clientIP,
                        user_agent: userAgent,
                        created_at: new Date()
                    });
                }
            }
        } catch (logError) {
            console.error('Error logging section creation activity:', logError);
            // Don't fail the section creation if logging fails
        }

        // Get complete section details
        const sectionDetails = await db.collection('sections').aggregate([
            {
                $match: { _id: newSectionId }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'adviser_id',
                    foreignField: '_id',
                    as: 'adviser'
                }
            },
            {
                $lookup: {
                    from: 'rooms',
                    localField: 'room_id',
                    foreignField: '_id',
                    as: 'room'
                }
            },
            {
                $lookup: {
                    from: 'section_students',
                    localField: '_id',
                    foreignField: 'section_id',
                    as: 'students',
                    pipeline: [{ $match: { status: 'active' } }]
                }
            },
            {
                $addFields: {
                    id: '$_id',
                    adviser_name: { $arrayElemAt: ['$adviser.full_name', 0] },
                    room_name: { $arrayElemAt: ['$room.name', 0] },
                    student_count: { $size: '$students' }
                }
            }
        ]).toArray();
        
        return json({ 
            success: true, 
            data: sectionDetails[0],
            message: `Section ${sectionName} created successfully with ${studentIds ? studentIds.length : 0} students`
        });

    } catch (error) {
        console.error('Error creating section:', error);
        return json({ success: false, error: 'Failed to create section' }, { status: 500 });
    }
}

// PUT - Update section details
export async function PUT({ request, getClientAddress }) {
    console.log('=== PUT REQUEST STARTED ===');
    try {
        // Verify authentication - only admins can update sections
        const authResult = await verifyAuth(request, ['admin']);
        if (!authResult.success) {
            return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
        }
        const user = authResult.user;
        
        const db = await connectToDatabase();
        console.log('Database connected successfully');
        
        const requestBody = await request.json();
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        
        // Handle both formats from frontend
        const sectionId = requestBody.sectionId || requestBody.section_id;
        const updates = requestBody.updates || {
            name: requestBody.sectionName,
            adviserId: requestBody.adviserId,
            studentIds: requestBody.studentIds,
            roomId: requestBody.roomId
        };
        
        console.log('Parsed sectionId:', sectionId);
        console.log('Parsed updates:', JSON.stringify(updates, null, 2));
        
        const clientIP = getClientAddress();
        const userAgent = request.headers.get('user-agent');

        if (!sectionId) {
            console.log('Section ID missing - returning 400');
            return json({ success: false, error: 'Section ID is required' }, { status: 400 });
        }

        console.log('Starting database operations...');
        // Get current section details
        const currentSection = await db.collection('sections').findOne({ 
            _id: new ObjectId(sectionId),
            status: 'active'
        });
        
        console.log('Current section found:', currentSection ? 'YES' : 'NO');
        console.log('Current section data:', currentSection);

        if (!currentSection) {
            return json({ success: false, error: 'Section not found' }, { status: 404 });
        }

        const updateData = { 
            $set: { updated_at: new Date() }
        };
        const changes = [];

        // Handle section name update
        if (updates.name && updates.name !== currentSection.name) {
            // Check if new name already exists for the same grade level and school year
            const existingSection = await db.collection('sections').findOne({
                name: updates.name,
                grade_level: currentSection.grade_level,
                school_year: currentSection.school_year,
                status: 'active',
                _id: { $ne: new ObjectId(sectionId) }
            });

            if (existingSection) {
                return json({ 
                    success: false, 
                    error: 'A section with this name already exists for the same grade level and school year' 
                }, { status: 400 });
            }

            updateData.$set.name = updates.name;
            changes.push(`Name changed from "${currentSection.name}" to "${updates.name}"`);
        }

        // Handle adviser update
        let adviserChangeLog = null; // Track adviser changes for specific logging
        if (updates.adviserId !== undefined) {
            if (updates.adviserId && updates.adviserId !== currentSection.adviser_id?.toString()) {
                // Validate new adviser
                const adviser = await db.collection('users').findOne({
                    _id: new ObjectId(updates.adviserId),
                    account_type: 'teacher',
                    status: 'active'
                });

                if (!adviser) {
                    return json({ 
                        success: false, 
                        error: 'Invalid adviser selected' 
                    }, { status: 400 });
                }

                // Check if adviser is already assigned to another section
                const existingAdviserSection = await db.collection('sections').findOne({
                    adviser_id: new ObjectId(updates.adviserId),
                    school_year: currentSection.school_year,
                    status: 'active',
                    _id: { $ne: new ObjectId(sectionId) }
                });

                if (existingAdviserSection) {
                    return json({ 
                        success: false, 
                        error: 'This teacher is already assigned as an adviser to another section' 
                    }, { status: 400 });
                }

                updateData.$set.adviser_id = new ObjectId(updates.adviserId);
                changes.push(`Adviser assigned: ${adviser.full_name}`);
                
                // Prepare adviser change log
                adviserChangeLog = {
                    type: currentSection.adviser_id ? 'adviser_changed' : 'adviser_assigned',
                    newAdviser: {
                        name: adviser.full_name,
                        account_number: adviser.account_number
                    },
                    oldAdviser: null
                };
                
                // If there was a previous adviser, get their details
                if (currentSection.adviser_id) {
                    const oldAdviser = await db.collection('users').findOne({
                        _id: currentSection.adviser_id
                    });
                    if (oldAdviser) {
                        adviserChangeLog.oldAdviser = {
                            name: oldAdviser.full_name,
                            account_number: oldAdviser.account_number
                        };
                    }
                }
            } else if (!updates.adviserId && currentSection.adviser_id) {
                // Get old adviser details before removing
                const oldAdviser = await db.collection('users').findOne({
                    _id: currentSection.adviser_id
                });
                
                updateData.$unset = { adviser_id: "" };
                changes.push('Adviser removed');
                
                // Prepare adviser removal log
                if (oldAdviser) {
                    adviserChangeLog = {
                        type: 'adviser_removed',
                        oldAdviser: {
                            name: oldAdviser.full_name,
                            account_number: oldAdviser.account_number
                        }
                    };
                }
            }
        }

        // Handle room update
        if (updates.roomId !== undefined) {
            if (updates.roomId && updates.roomId !== currentSection.room_id?.toString()) {
                // Validate new room
                const room = await db.collection('rooms').findOne({
                    _id: new ObjectId(updates.roomId),
                    status: 'active'
                });

                if (!room) {
                    return json({ 
                        success: false, 
                        error: 'Invalid room selected' 
                    }, { status: 400 });
                }

                // Check if room is already assigned
                const existingRoomSection = await db.collection('sections').findOne({
                    room_id: new ObjectId(updates.roomId),
                    status: 'active',
                    _id: { $ne: new ObjectId(sectionId) }
                });

                if (existingRoomSection) {
                    return json({ 
                        success: false, 
                        error: 'This room is already assigned to another section' 
                    }, { status: 400 });
                }

                updateData.$set.room_id = new ObjectId(updates.roomId);
                changes.push(`Room assigned: ${room.name}`);
            } else if (!updates.roomId && currentSection.room_id) {
                if (!updateData.$unset) updateData.$unset = {};
                updateData.$unset.room_id = "";
                changes.push('Room removed');
            }
        }

        // Handle student list updates (complete replacement approach)
        if (updates.studentIds !== undefined) {
            const newStudentIds = updates.studentIds || [];
            
            // Get current students in the section
            const currentStudents = await db.collection('section_students').find({
                section_id: new ObjectId(sectionId),
                status: 'active'
            }).toArray();
            
            const currentStudentIds = currentStudents.map(s => s.student_id.toString());
            const newStudentIdStrings = newStudentIds.map(id => id.toString());
            
            // Find students to add and remove
            const studentsToAdd = newStudentIds.filter(id => !currentStudentIds.includes(id.toString()));
            const studentsToRemove = currentStudentIds.filter(id => !newStudentIdStrings.includes(id));
            
            // Add new students
            if (studentsToAdd.length > 0) {
                // Filter out invalid IDs and validate ObjectId format
                const validStudentIds = studentsToAdd.filter(id => {
                    try {
                        return id && ObjectId.isValid(id);
                    } catch (e) {
                        return false;
                    }
                });

                if (validStudentIds.length === 0) {
                    return json({ 
                        success: false, 
                        error: 'No valid student IDs provided' 
                    }, { status: 400 });
                }

                // Validate students
                const students = await db.collection('users').find({
                    _id: { $in: validStudentIds.map(id => new ObjectId(id)) },
                    account_type: 'student',
                    status: 'active',
                    grade_level: currentSection.grade_level.toString()
                }).toArray();

                if (students.length !== validStudentIds.length) {
                    return json({ 
                        success: false, 
                        error: 'Some selected students are invalid or not available' 
                    }, { status: 400 });
                }

                // Check if any students are already enrolled in other sections
                const existingEnrollments = await db.collection('section_students').find({
                    student_id: { $in: validStudentIds.map(id => new ObjectId(id)) },
                    status: 'active'
                }).toArray();

                if (existingEnrollments.length > 0) {
                    return json({ 
                        success: false, 
                        error: 'Some students are already enrolled in other sections' 
                    }, { status: 400 });
                }

                // Add students to section
                const enrollmentData = validStudentIds.map(studentId => ({
                    section_id: new ObjectId(sectionId),
                    student_id: new ObjectId(studentId),
                    enrolled_at: new Date(),
                    status: 'active'
                }));

                await db.collection('section_students').insertMany(enrollmentData);
                changes.push(`Added ${validStudentIds.length} students`);

                // Log individual student additions
                const activityCollection = db.collection('activity_logs');
                for (const student of students) {
                    await activityCollection.insertOne({
                        activity_type: 'student_added_to_section',
                        user_id: user?.id ? new ObjectId(user.id) : null,
                        user_account_number: user?.account_number || null,
                        activity_data: {
                            section_name: currentSection.name,
                            student: {
                                name: student.full_name,
                                account_number: student.account_number
                            }
                        },
                        ip_address: clientIP,
                        user_agent: userAgent,
                        created_at: new Date()
                    });
                }
            }
            
            // Remove students
            if (studentsToRemove.length > 0) {
                // Filter out invalid IDs and validate ObjectId format
                const validRemoveIds = studentsToRemove.filter(id => {
                    try {
                        return id && ObjectId.isValid(id);
                    } catch (e) {
                        return false;
                    }
                });

                if (validRemoveIds.length > 0) {
                    // Remove students from section
                    await db.collection('section_students').updateMany(
                        {
                            section_id: new ObjectId(sectionId),
                            student_id: { $in: validRemoveIds.map(id => new ObjectId(id)) },
                            status: 'active'
                        },
                        {
                            $set: { 
                                status: 'inactive',
                                removed_at: new Date()
                            }
                        }
                    );

                    changes.push(`Removed ${validRemoveIds.length} students`);

                    // Log individual student removals
                    const removedStudents = await db.collection('users').find({
                        _id: { $in: validRemoveIds.map(id => new ObjectId(id)) }
                    }).toArray();

                    const activityCollection = db.collection('activity_logs');
                    for (const student of removedStudents) {
                        await activityCollection.insertOne({
                            activity_type: 'student_removed_from_section',
                            user_id: user?.id ? new ObjectId(user.id) : null,
                            user_account_number: user?.account_number || null,
                            activity_data: {
                                section_name: currentSection.name,
                                student: {
                                    name: student.full_name,
                                    account_number: student.account_number
                                }
                            },
                            ip_address: clientIP,
                            user_agent: userAgent,
                            created_at: new Date()
                        });
                    }
                }
            }
        }

        // Update section if there are changes
        if (Object.keys(updateData.$set).length > 1 || updateData.$unset) { // More than just updated_at
            console.log('Updating section with data:', JSON.stringify(updateData, null, 2));
            await db.collection('sections').updateOne(
                { _id: new ObjectId(sectionId) },
                updateData
            );
        }

        // Log adviser changes specifically
        if (adviserChangeLog) {
            const activityCollection = db.collection('activity_logs');
            
            if (adviserChangeLog.type === 'adviser_assigned') {
                await activityCollection.insertOne({
                    activity_type: 'adviser_assigned_to_section',
                    user_id: user?.id ? new ObjectId(user.id) : null,
                    user_account_number: user?.account_number || null,
                    activity_data: {
                        section_name: currentSection.name,
                        grade_level: currentSection.grade_level,
                        adviser: adviserChangeLog.newAdviser
                    },
                    ip_address: clientIP,
                    user_agent: userAgent,
                    created_at: new Date()
                });
            } else if (adviserChangeLog.type === 'adviser_changed') {
                await activityCollection.insertOne({
                    activity_type: 'adviser_changed_in_section',
                    user_id: user?.id ? new ObjectId(user.id) : null,
                    user_account_number: user?.account_number || null,
                    activity_data: {
                        section_name: currentSection.name,
                        grade_level: currentSection.grade_level,
                        old_adviser: adviserChangeLog.oldAdviser,
                        new_adviser: adviserChangeLog.newAdviser
                    },
                    ip_address: clientIP,
                    user_agent: userAgent,
                    created_at: new Date()
                });
            } else if (adviserChangeLog.type === 'adviser_removed') {
                await activityCollection.insertOne({
                    activity_type: 'adviser_removed_from_section',
                    user_id: user?.id ? new ObjectId(user.id) : null,
                    user_account_number: user?.account_number || null,
                    activity_data: {
                        section_name: currentSection.name,
                        grade_level: currentSection.grade_level,
                        adviser: adviserChangeLog.oldAdviser
                    },
                    ip_address: clientIP,
                    user_agent: userAgent,
                    created_at: new Date()
                });
            }
        }
        
        // Log section update activity (only for non-student and non-adviser changes)
        const nonStudentAdviserChanges = changes.filter(change => 
            !change.includes('Added') && 
            !change.includes('Removed') && 
            !change.includes('students') &&
            !change.includes('Adviser')
        );
        
        if (nonStudentAdviserChanges.length > 0) {
            // Create activity log with proper structure for non-student/non-adviser changes only
            const activityCollection = db.collection('activity_logs');
            await activityCollection.insertOne({
                activity_type: 'section_updated',
                user_id: user?.id ? new ObjectId(user.id) : null,
                user_account_number: user?.account_number || null,
                activity_data: {
                    section_name: currentSection.name
                },
                ip_address: clientIP,
                user_agent: userAgent,
                created_at: new Date()
            });
        }

        // Get updated section details
        const updatedSection = await db.collection('sections').aggregate([
            {
                $match: { _id: new ObjectId(sectionId) }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'adviser_id',
                    foreignField: '_id',
                    as: 'adviser'
                }
            },
            {
                $lookup: {
                    from: 'rooms',
                    localField: 'room_id',
                    foreignField: '_id',
                    as: 'room'
                }
            },
            {
                $lookup: {
                    from: 'section_students',
                    localField: '_id',
                    foreignField: 'section_id',
                    as: 'students',
                    pipeline: [{ $match: { status: 'active' } }]
                }
            },
            {
                $addFields: {
                    id: '$_id',
                    adviser_name: { $arrayElemAt: ['$adviser.full_name', 0] },
                    room_name: { $arrayElemAt: ['$room.name', 0] },
                    student_count: { $size: '$students' }
                }
            }
        ]).toArray();

        return json({ 
            success: true, 
            data: updatedSection[0],
            message: changes.length > 0 ? `Section updated: ${changes.join(', ')}` : 'No changes made'
        });

    } catch (error) {
        console.error('Error updating section:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        return json({ success: false, error: 'Failed to update section' }, { status: 500 });
    }
}

// DELETE - Remove section
export async function DELETE({ request, getClientAddress, url }) {
    try {
        // Verify authentication - only admins can delete sections
        const authResult = await verifyAuth(request, ['admin']);
        if (!authResult.success) {
            return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
        }
        
        const db = await connectToDatabase();
        
        // Get sectionId from URL parameters instead of request body
        const sectionId = url.searchParams.get('sectionId');
        
        const clientIP = getClientAddress();
        const userAgent = request.headers.get('user-agent');

        if (!sectionId) {
            return json({ success: false, error: 'Section ID is required' }, { status: 400 });
        }

        // Get section details for logging
        const section = await db.collection('sections').findOne({ 
            _id: new ObjectId(sectionId),
            status: 'active'
        });

        if (!section) {
            return json({ success: false, error: 'Section not found' }, { status: 404 });
        }

        // Get student count for logging
        const studentCount = await db.collection('section_students').countDocuments({
            section_id: new ObjectId(sectionId),
            status: 'active'
        });

        // Free up room if assigned
        if (section.room_id) {
            await db.collection('rooms').updateOne(
                { _id: section.room_id },
                {
                    $set: {
                        status: 'available',
                        updated_at: new Date()
                    },
                    $unset: { assigned_to: "" }
                }
            );
        }

        // Remove all students from section
        await db.collection('section_students').updateMany(
            { 
                section_id: new ObjectId(sectionId),
                status: 'active'
            },
            {
                $set: {
                    status: 'inactive',
                    removed_at: new Date()
                }
            }
        );

        // Delete the section (soft delete)
        await db.collection('sections').updateOne(
            { _id: new ObjectId(sectionId) },
            {
                $set: {
                    status: 'inactive',
                    deleted_at: new Date()
                }
            }
        );

        // Log section deletion
        try {
            // Create activity log with proper structure
            const activityCollection = db.collection('activity_logs');
            await activityCollection.insertOne({
                activity_type: 'section_deleted',
                user_id: user?.id ? new ObjectId(user.id) : null,
                user_account_number: user?.account_number || null,
                activity_data: {
                    section_name: section.name,
                    grade_level: section.grade_level,
                    school_year: section.school_year,
                    student_count: studentCount
                },
                ip_address: clientIP,
                user_agent: userAgent,
                created_at: new Date()
            });
        } catch (logError) {
            console.error('Error logging section deletion activity:', logError);
            // Don't fail the deletion if logging fails
        }

        return json({ 
            success: true, 
            message: `Section ${section.name} has been deleted successfully`
        });

    } catch (error) {
        console.error('Error deleting section:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        return json({ success: false, error: 'Failed to delete section' }, { status: 500 });
    }
}