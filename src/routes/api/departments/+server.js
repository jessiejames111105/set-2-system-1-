import { json } from '@sveltejs/kit';
import { client } from '../../database/db.js';
import { ObjectId } from 'mongodb';
import { getUserFromRequest } from '../helper/auth-helper.js';

// GET - Fetch departments (subject groupings), subjects, and teachers
export async function GET({ url }) {
    try {
        const action = url.searchParams.get('action');

        // Connect to MongoDB
        await client.connect();
        const db = client.db('set-2-system');

        switch (action) {
            case 'subjects':
                const subjectsCollection = db.collection('subjects');
                
                // Use aggregation to join subjects with departments
                const subjectsResult = await subjectsCollection.aggregate([
                    {
                        $lookup: {
                            from: 'departments',
                            localField: 'department_id',
                            foreignField: '_id',
                            as: 'department'
                        }
                    },
                    {
                        $unwind: {
                            path: '$department',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            id: { $toString: '$_id' },
                            name: 1,
                            code: 1,
                            grade_level: 1,
                            created_at: 1,
                            department_id: { $toString: '$department_id' },
                            department_name: '$department.name',
                            department_code: '$department.code'
                        }
                    },
                    {
                        $sort: { grade_level: 1, name: 1 }
                    }
                ]).toArray();
                
                return json({ success: true, data: subjectsResult });

            case 'teachers':
                const usersCollection = db.collection('users');
                const teacherDepartmentsCollection = db.collection('teacher_departments');
                
                // Use aggregation to get teachers with their departments
                const teachersResult = await usersCollection.aggregate([
                    {
                        $match: {
                            account_type: 'teacher',
                            status: 'active'
                        }
                    },
                    {
                        $lookup: {
                            from: 'teacher_departments',
                            localField: '_id',
                            foreignField: 'teacher_id',
                            as: 'teacher_departments'
                        }
                    },
                    {
                        $lookup: {
                            from: 'departments',
                            localField: 'teacher_departments.department_id',
                            foreignField: '_id',
                            as: 'departments'
                        }
                    },
                    {
                        $project: {
                            id: { $toString: '$_id' },
                            account_number: 1,
                            first_name: 1,
                            last_name: 1,
                            full_name: 1,
                            email: 1,
                            status: 1,
                            departments: {
                                $map: {
                                    input: '$departments',
                                    as: 'dept',
                                    in: {
                                        id: { $toString: '$$dept._id' },
                                        name: '$$dept.name',
                                        code: '$$dept.code'
                                    }
                                }
                            }
                        }
                    },
                    {
                        $sort: { full_name: 1 }
                    }
                ]).toArray();
                
                return json({ success: true, data: teachersResult });

            case 'departments':
            default:
                const departmentsCollection = db.collection('departments');
                
                // Get departments with their subjects and teachers
                const departmentsResult = await departmentsCollection.aggregate([
                    {
                        $lookup: {
                            from: 'subjects',
                            localField: '_id',
                            foreignField: 'department_id',
                            as: 'subjects'
                        }
                    },
                    {
                        $lookup: {
                            from: 'teacher_departments',
                            localField: '_id',
                            foreignField: 'department_id',
                            as: 'teacher_departments'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'teacher_departments.teacher_id',
                            foreignField: '_id',
                            as: 'teachers_data'
                        }
                    },
                    {
                        $project: {
                            id: { $toString: '$_id' },
                            name: 1,
                            code: 1,
                            created_at: 1,
                            subjects: {
                                $map: {
                                    input: '$subjects',
                                    as: 'subject',
                                    in: {
                                        id: { $toString: '$$subject._id' },
                                        name: '$$subject.name',
                                        code: '$$subject.code',
                                        grade_level: '$$subject.grade_level'
                                    }
                                }
                            },
                            subject_count: { $size: '$subjects' },
                            teachers: {
                                $map: {
                                    input: {
                                        $filter: {
                                            input: '$teachers_data',
                                            as: 'teacher',
                                            cond: { $eq: ['$$teacher.status', 'active'] }
                                        }
                                    },
                                    as: 'teacher',
                                    in: {
                                        id: { $toString: '$$teacher._id' },
                                        full_name: '$$teacher.full_name',
                                        account_number: '$$teacher.account_number'
                                    }
                                }
                            },
                            teacher_count: {
                                $size: {
                                    $filter: {
                                        input: '$teachers_data',
                                        as: 'teacher',
                                        cond: { $eq: ['$$teacher.status', 'active'] }
                                    }
                                }
                            }
                        }
                    },
                    {
                        $sort: { name: 1 }
                    }
                ]).toArray();
                
                return json({ success: true, data: departmentsResult });
        }
    } catch (error) {
        console.error('Error fetching departments data:', error);
        return json({ success: false, error: 'Failed to fetch data' }, { status: 500 });
    }
}

// POST - Create new department
export async function POST({ request, getClientAddress }) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { name, code, teachers = [] } = await request.json();

        if (!name || !code) {
            return json({ success: false, error: 'Department name and code are required' }, { status: 400 });
        }

        // Connect to MongoDB
        await client.connect();
        const db = client.db('set-2-system');
        const departmentsCollection = db.collection('departments');
        const teacherDepartmentsCollection = db.collection('teacher_departments');
        const usersCollection = db.collection('users');

        // Check if department already exists
        const existingDept = await departmentsCollection.findOne({
            $or: [
                { name: name },
                { code: code.toUpperCase() }
            ]
        });

        if (existingDept) {
            return json({ success: false, error: 'Department name or code already exists' }, { status: 400 });
        }

        // Create the department in the database
        const newDepartment = {
            name: name,
            code: code.toUpperCase(),
            status: 'active',
            created_at: new Date()
        };

        const insertResult = await departmentsCollection.insertOne(newDepartment);
        
        if (!insertResult.insertedId) {
            throw new Error('Failed to create department');
        }

        // Add the ID to the department object for response
        newDepartment.id = insertResult.insertedId.toString();
        newDepartment._id = insertResult.insertedId;

        // Assign teachers to the department if provided
        if (teachers.length > 0) {
            const assignedTeachers = [];
            for (const teacherId of teachers) {
                // Insert teacher-department relationship
                await teacherDepartmentsCollection.insertOne({
                    teacher_id: new ObjectId(teacherId),
                    department_id: insertResult.insertedId
                });
                
                // Get teacher info for logging
                const teacherInfo = await usersCollection.findOne(
                    { _id: new ObjectId(teacherId) },
                    { projection: { full_name: 1, account_number: 1 } }
                );
                if (teacherInfo) {
                    assignedTeachers.push({
                        id: teacherInfo._id.toString(),
                        full_name: teacherInfo.full_name,
                        account_number: teacherInfo.account_number
                    });
                }
            }

            // Log teacher assignments if any were made
            if (assignedTeachers.length > 0) {
                try {
                    // Create activity log with proper structure (matching accounts API)
                    const activityCollection = db.collection('activity_logs');
                    await activityCollection.insertOne({
                        activity_type: 'department_teacher_assigned',
                        user_id: user?.id ? new ObjectId(user.id) : null,
                        user_account_number: user?.accountNumber || null,
                        activity_data: { 
                            department_id: insertResult.insertedId.toString(), 
                            department_name: name, 
                            department_code: code.toUpperCase(),
                            teachers: assignedTeachers
                        },
                        ip_address: getClientAddress(),
                        user_agent: request.headers.get('user-agent'),
                        created_at: new Date()
                    });
                } catch (logError) {
                    console.error('Error logging teacher assignment activity:', logError);
                }
            }
        }

        // Log the department creation
        try {
            // Create activity log with proper structure (matching accounts API)
            const activityCollection = db.collection('activity_logs');
            await activityCollection.insertOne({
                activity_type: 'department_created',
                user_id: user?.id ? new ObjectId(user.id) : null,
                user_account_number: user?.accountNumber || null,
                activity_data: { 
                    department_id: insertResult.insertedId.toString(), 
                    department_name: name, 
                    department_code: code.toUpperCase()
                },
                ip_address: getClientAddress(),
                user_agent: request.headers.get('user-agent'),
                created_at: new Date()
            });
        } catch (logError) {
            console.error('Error logging department creation activity:', logError);
        }

        return json({ 
            success: true, 
            message: 'Department created successfully',
            data: {
                ...newDepartment,
                subjects: [],
                teachers: [],
                subject_count: 0,
                teacher_count: teachers.length
            }
        });
    } catch (error) {
        console.error('Error creating department:', error);
        if (error.code === 11000) { // MongoDB duplicate key error
            return json({ success: false, error: 'Department name or code already exists' }, { status: 400 });
        }
        return json({ success: false, error: 'Failed to create department' }, { status: 500 });
    }
}

// PUT - Update department
export async function PUT({ request, getClientAddress }) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const requestBody = await request.json();
        
        const { id, name, code, teachers = [], subjects = [] } = requestBody;

        if (!id || !name || !code) {
            return json({ success: false, error: 'Department ID, name and code are required' }, { status: 400 });
        }

        // Validate department code length (database limit is 20 characters)
        if (code.length > 20) {
            return json({ success: false, error: 'Department code cannot exceed 20 characters' }, { status: 400 });
        }

        // Validate department name length (database limit is 100 characters)
        if (name.length > 100) {
            return json({ success: false, error: 'Department name cannot exceed 100 characters' }, { status: 400 });
        }

        // Connect to MongoDB
        await client.connect();
        const db = client.db('set-2-system');
        const departmentsCollection = db.collection('departments');
        const teacherDepartmentsCollection = db.collection('teacher_departments');
        const subjectsCollection = db.collection('subjects');
        const usersCollection = db.collection('users');

        // Get current department info to check if name or code changed
        const currentDept = await departmentsCollection.findOne(
            { _id: new ObjectId(id), status: 'active' },
            { projection: { name: 1, code: 1 } }
        );

        if (!currentDept) {
            return json({ success: false, error: 'Department not found' }, { status: 404 });
        }

        const nameChanged = currentDept.name !== name;
        const codeChanged = currentDept.code !== code.toUpperCase();
        const basicInfoChanged = nameChanged || codeChanged;

        // Check if new name or code already exists (excluding current department)
        if (basicInfoChanged) {
            const existingDept = await departmentsCollection.findOne({
                _id: { $ne: new ObjectId(id) },
                $or: [
                    { name: name },
                    { code: code.toUpperCase() }
                ]
            });

            if (existingDept) {
                return json({ success: false, error: 'Department name or code already exists' }, { status: 400 });
            }
        }

        // Update the department in the database
        const updateResult = await departmentsCollection.updateOne(
            { _id: new ObjectId(id), status: 'active' },
            { 
                $set: { 
                    name: name, 
                    code: code.toUpperCase(), 
                    updated_at: new Date() 
                } 
            }
        );

        if (updateResult.matchedCount === 0) {
            return json({ success: false, error: 'Department not found' }, { status: 404 });
        }

        // Update teacher assignments
        // First, get current teacher assignments for comparison
        const currentTeachersResult = await teacherDepartmentsCollection.aggregate([
            {
                $match: { department_id: new ObjectId(id) }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'teacher_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    id: { $toString: '$user._id' },
                    full_name: '$user.full_name',
                    account_number: '$user.account_number'
                }
            }
        ]).toArray();

        // Compare current and new teacher assignments to detect changes
        const currentTeacherIds = new Set(currentTeachersResult.map(t => t.id));
        const newTeacherIds = new Set(teachers);
        
        // Find removed teachers (in current but not in new)
        const removedTeachers = currentTeachersResult.filter(t => !newTeacherIds.has(t.id));
        
        // Find added teachers (in new but not in current)
        const addedTeacherIds = teachers.filter(id => !currentTeacherIds.has(id));
        
        // Only update teacher assignments if there are actual changes
        const teachersChanged = removedTeachers.length > 0 || addedTeacherIds.length > 0;
        
        if (teachersChanged) {
            // Remove all existing teacher assignments for this department
            await teacherDepartmentsCollection.deleteMany({ department_id: new ObjectId(id) });

            // Log teacher removals if any existed
            if (removedTeachers.length > 0) {
                try {
                    const activityCollection = db.collection('activity_logs');
                    await activityCollection.insertOne({
                        activity_type: 'department_teacher_removed',
                        user_id: user?.id ? new ObjectId(user.id) : null,
                        user_account_number: user?.accountNumber || null,
                        activity_data: { 
                            department_id: id, 
                            department_name: name, 
                            department_code: code.toUpperCase(),
                            teachers: removedTeachers
                        },
                        ip_address: getClientAddress(),
                        user_agent: request.headers.get('user-agent'),
                        created_at: new Date()
                    });
                } catch (logError) {
                    console.error('Error logging teacher removal activity:', logError);
                }
            }

            // Add the new teacher assignments
            if (teachers.length > 0) {
                const newTeachers = [];
                const teacherAssignments = [];
                
                for (const teacherId of teachers) {
                    teacherAssignments.push({
                        teacher_id: new ObjectId(teacherId),
                        department_id: new ObjectId(id)
                    });
                    
                    // Get teacher info for logging
                    const teacherInfo = await usersCollection.findOne(
                        { _id: new ObjectId(teacherId) },
                        { projection: { full_name: 1, account_number: 1 } }
                    );
                    if (teacherInfo) {
                        newTeachers.push({
                            id: teacherInfo._id.toString(),
                            full_name: teacherInfo.full_name,
                            account_number: teacherInfo.account_number
                        });
                    }
                }

                // Insert all teacher assignments at once
                if (teacherAssignments.length > 0) {
                    await teacherDepartmentsCollection.insertMany(teacherAssignments);
                }

                // Only log assignments for newly added teachers
                const addedTeachers = newTeachers.filter(t => addedTeacherIds.includes(t.id));
                if (addedTeachers.length > 0) {
                    try {
                        const activityCollection = db.collection('activity_logs');
                        await activityCollection.insertOne({
                            activity_type: 'department_teacher_assigned',
                            user_id: user?.id ? new ObjectId(user.id) : null,
                            user_account_number: user?.accountNumber || null,
                            activity_data: { 
                                department_id: id, 
                                department_name: name, 
                                department_code: code.toUpperCase(),
                                teachers: addedTeachers
                            },
                            ip_address: getClientAddress(),
                            user_agent: request.headers.get('user-agent'),
                            created_at: new Date()
                        });
                    } catch (logError) {
                        console.error('Error logging teacher assignment activity:', logError);
                    }
                }
            }
        }

        // Update subject assignments
        // First, get current subject assignments for comparison
        const currentSubjects = await subjectsCollection.find(
            { department_id: new ObjectId(id) },
            { projection: { name: 1, code: 1 } }
        ).toArray();

        // Compare current and new subject assignments to detect changes
        const currentSubjectIds = new Set(currentSubjects.map(s => s._id.toString()));
        const newSubjectIds = new Set(subjects);
        
        // Find removed subjects (in current but not in new)
        const removedSubjects = currentSubjects.filter(s => !newSubjectIds.has(s._id.toString()));
        
        // Find added subjects (in new but not in current)
        const addedSubjectIds = subjects.filter(id => !currentSubjectIds.has(id));
        
        // Only update subject assignments if there are actual changes
        const subjectsChanged = removedSubjects.length > 0 || addedSubjectIds.length > 0;
        
        if (subjectsChanged) {
            // Update all subjects that were previously assigned to this department to have no department
            await subjectsCollection.updateMany(
                { department_id: new ObjectId(id) },
                { $unset: { department_id: "" } }
            );

            // Log subject removals if any were removed
            if (removedSubjects.length > 0) {
                const removedSubjectsForLog = removedSubjects.map(subject => ({
                    id: subject._id.toString(),
                    name: subject.name,
                    code: subject.code
                }));

                try {
                    const activityCollection = db.collection('activity_logs');
                    await activityCollection.insertOne({
                        activity_type: 'department_subject_removed',
                        user_id: user?.id ? new ObjectId(user.id) : null,
                        user_account_number: user?.accountNumber || null,
                        activity_data: { 
                            department_id: id, 
                            department_name: name, 
                            department_code: code.toUpperCase(),
                            subjects: removedSubjectsForLog
                        },
                        ip_address: getClientAddress(),
                        user_agent: request.headers.get('user-agent'),
                        created_at: new Date()
                    });
                } catch (logError) {
                    console.error('Error logging subject removal activity:', logError);
                }
            }

            // Then assign the selected subjects to this department
            if (subjects.length > 0) {
                const subjectIds = subjects.map(subjectId => new ObjectId(subjectId));
                
                // Update subjects to assign them to this department
                await subjectsCollection.updateMany(
                    { _id: { $in: subjectIds } },
                    { $set: { department_id: new ObjectId(id) } }
                );
                
                // Only log assignments for newly added subjects
                if (addedSubjectIds.length > 0) {
                    const addedSubjectObjectIds = addedSubjectIds.map(id => new ObjectId(id));
                    const addedSubjectInfos = await subjectsCollection.find(
                        { _id: { $in: addedSubjectObjectIds } },
                        { projection: { name: 1, code: 1 } }
                    ).toArray();

                    const addedSubjectsForLog = addedSubjectInfos.map(subject => ({
                        id: subject._id.toString(),
                        name: subject.name,
                        code: subject.code
                    }));

                    if (addedSubjectsForLog.length > 0) {
                        try {
                            const activityCollection = db.collection('activity_logs');
                            await activityCollection.insertOne({
                                activity_type: 'department_subject_assigned',
                                user_id: user?.id ? new ObjectId(user.id) : null,
                                user_account_number: user?.accountNumber || null,
                                activity_data: { 
                                    department_id: id, 
                                    department_name: name, 
                                    department_code: code.toUpperCase(),
                                    subjects: addedSubjectsForLog
                                },
                                ip_address: getClientAddress(),
                                user_agent: request.headers.get('user-agent'),
                                created_at: new Date()
                            });
                        } catch (logError) {
                            console.error('Error logging subject assignment activity:', logError);
                        }
                    }
                }
            }
        }

        // Log the department update only if basic info (name or code) changed
        if (basicInfoChanged) {
            try {
                // Create activity log with proper structure (matching accounts API)
                const activityCollection = db.collection('activity_logs');
                await activityCollection.insertOne({
                    activity_type: 'department_updated',
                    user_id: user?.id ? new ObjectId(user.id) : null,
                    user_account_number: user?.accountNumber || null,
                    activity_data: { 
                        department_id: id, 
                        department_name: name, 
                        department_code: code.toUpperCase() 
                    },
                    ip_address: getClientAddress(),
                    user_agent: request.headers.get('user-agent'),
                    created_at: new Date()
                });
            } catch (logError) {
                console.error('Error logging department update activity:', logError);
            }
        }

        // Get updated department data for response
        const updatedDepartment = await departmentsCollection.findOne(
            { _id: new ObjectId(id) },
            { projection: { name: 1, code: 1, status: 1, created_at: 1, updated_at: 1 } }
        );

        return json({ 
            success: true, 
            message: 'Department updated successfully',
            data: {
                id: updatedDepartment._id.toString(),
                name: updatedDepartment.name,
                code: updatedDepartment.code,
                status: updatedDepartment.status,
                created_at: updatedDepartment.created_at,
                updated_at: updatedDepartment.updated_at
            }
        });
    } catch (error) {
        console.error('Error updating department:', error);
        if (error.code === 11000) { // MongoDB duplicate key error
            return json({ success: false, error: 'Department name or code already exists' }, { status: 400 });
        }
        return json({ success: false, error: 'Failed to update department' }, { status: 500 });
    }
}

// DELETE - Delete department
export async function DELETE({ request, getClientAddress }) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await request.json();

        if (!id) {
            return json({ success: false, error: 'Department ID is required' }, { status: 400 });
        }

        // Connect to MongoDB
        await client.connect();
        const db = client.db('set-2-system');
        const departmentsCollection = db.collection('departments');
        const teacherDepartmentsCollection = db.collection('teacher_departments');
        const subjectsCollection = db.collection('subjects');

        // Get department info for logging before deletion
        const department = await departmentsCollection.findOne(
            { _id: new ObjectId(id), status: 'active' },
            { projection: { name: 1, code: 1 } }
        );

        if (!department) {
            return json({ success: false, error: 'Department not found' }, { status: 404 });
        }

        // Check if there are subjects assigned to this department and update them
        const subjectsResult = await subjectsCollection.find(
            { department_id: new ObjectId(id) },
            { projection: { _id: 1 } }
        ).toArray();

        if (subjectsResult.length > 0) {
            // Update subjects to remove department assignment
            await subjectsCollection.updateMany(
                { department_id: new ObjectId(id) },
                { $unset: { department_id: "" } }
            );
        }

        // Delete teacher assignments for this department
        await teacherDepartmentsCollection.deleteMany({ department_id: new ObjectId(id) });

        // Delete the department
        const deleteResult = await departmentsCollection.deleteOne({ _id: new ObjectId(id) });

        if (deleteResult.deletedCount === 0) {
            return json({ success: false, error: 'Department not found' }, { status: 404 });
        }

        // Log the department deletion
        try {
            // Create activity log with proper structure (matching accounts API)
            const activityCollection = db.collection('activity_logs');
            await activityCollection.insertOne({
                activity_type: 'department_deleted',
                user_id: user?.id ? new ObjectId(user.id) : null,
                user_account_number: user?.accountNumber || null,
                activity_data: { 
                    department_id: id, 
                    department_name: department.name, 
                    department_code: department.code 
                },
                ip_address: getClientAddress(),
                user_agent: request.headers.get('user-agent'),
                created_at: new Date()
            });
        } catch (logError) {
            console.error('Error logging department deletion activity:', logError);
        }

        return json({ 
            success: true, 
            message: 'Department deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting department:', error);
        return json({ success: false, error: 'Failed to delete department' }, { status: 500 });
    }
}