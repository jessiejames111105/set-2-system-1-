import { json } from '@sveltejs/kit';
import { client } from '../../database/db.js';
import { getUserFromRequest, verifyAuth } from '../helper/auth-helper.js';
import { ObjectId } from 'mongodb';

// GET /api/subjects - Fetch all subjects with optional filtering
export async function GET({ url, request }) {
  try {
    // Verify authentication - admins, teachers, and advisers can view subjects
    const authResult = await verifyAuth(request, ['admin', 'teacher', 'adviser']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const action = url.searchParams.get('action');
    const searchTerm = url.searchParams.get('search') || '';
    const gradeLevel = url.searchParams.get('grade_level');
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const subjectsCollection = db.collection('subjects');
    const departmentsCollection = db.collection('departments');
    
    // Handle different actions
    if (action === 'available-subjects') {
      // For schedule form - filter by grade level if provided
      let filter = {};
      
      // Add grade level filter for available-subjects action
      if (gradeLevel && gradeLevel !== '') {
        filter.grade_level = parseInt(gradeLevel);
      }
      
      const subjects = await subjectsCollection
        .find(filter)
        .sort({ name: 1 })
        .toArray();
      
      // Get department information for each subject
      const subjectsWithDepartments = await Promise.all(
        subjects.map(async (subject) => {
          let department = null;
          if (subject.department_id) {
            department = await departmentsCollection.findOne({ _id: new ObjectId(subject.department_id) });
          }
          
          return {
            id: subject._id.toString(),
            name: subject.name,
            code: subject.code,
            grade_level: subject.grade_level,
            gradeLevel: `Grade ${subject.grade_level}`,
            department_id: subject.department_id,
            department_name: department?.name || null,
            department_code: department?.code || null
          };
        })
      );
      
      return json({
        success: true,
        data: subjectsWithDepartments
      });
    }
    
    // Default behavior for admin subjects management
    let filter = {};
    
    // Add search filter
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { code: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // Add grade level filter
    if (gradeLevel && gradeLevel !== '') {
      filter.grade_level = parseInt(gradeLevel);
    }
    
    const subjects = await subjectsCollection
      .find(filter)
      .sort({ created_at: -1 })
      .toArray();
    
    // Get department information for each subject
    const subjectsWithDepartments = await Promise.all(
      subjects.map(async (subject) => {
        let department = null;
        if (subject.department_id) {
          department = await departmentsCollection.findOne({ _id: new ObjectId(subject.department_id) });
        }
        
        return {
          id: subject._id.toString(),
          name: subject.name,
          code: subject.code,
          grade_level: subject.grade_level,
          gradeLevel: `Grade ${subject.grade_level}`,
          department_id: subject.department_id,
          department_name: department?.name || null,
          department_code: department?.code || null,
          icon: 'book',
          createdDate: new Date(subject.created_at).toLocaleDateString('en-US'),
          updatedDate: new Date(subject.updated_at).toLocaleDateString('en-US')
        };
      })
    );
    
    return json({
      success: true,
      data: subjectsWithDepartments
    });
    
  } catch (error) {
    console.error('Error fetching subjects:', error);
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({
        success: false,
        message: 'Database connection failed'
      }, { status: 503 });
    }
    
    return json({
      success: false,
      message: 'Failed to fetch subjects: ' + error.message
    }, { status: 500 });
  }
}

// POST /api/subjects - Create a new subject
export async function POST({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can create subjects
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const data = await request.json();
    const { name, code, gradeLevel, department_id } = data;
    
    // Validation
    if (!name || !code || !gradeLevel) {
      return json({
        success: false,
        message: 'Name, code, and grade level are required'
      }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const subjectsCollection = db.collection('subjects');
    
    // Check if subject code already exists
    const existingSubject = await subjectsCollection.findOne({ code: code });
    
    if (existingSubject) {
      return json({
        success: false,
        message: 'Subject code already exists'
      }, { status: 409 });
    }
    
    // Create new subject document
    const newSubject = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      grade_level: parseInt(gradeLevel),
      department_id: department_id || null,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await subjectsCollection.insertOne(newSubject);
    
    // Log the subject creation activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // Create activity log with proper structure (matching accounts API)
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'subject_created',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          name: newSubject.name,
          code: newSubject.code,
          grade_level: newSubject.grade_level
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging subject creation activity:', logError);
      // Don't fail the subject creation if logging fails
    }
    
    // Format response to match component structure
    const formattedSubject = {
      id: result.insertedId.toString(),
      name: newSubject.name,
      code: newSubject.code,
      gradeLevel: `Grade ${newSubject.grade_level}`,
      createdDate: new Date(newSubject.created_at).toLocaleDateString('en-US'),
      updatedDate: new Date(newSubject.updated_at).toLocaleDateString('en-US')
    };
    
    return json({
      success: true,
      message: `Subject "${name}" created successfully`,
      data: formattedSubject
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating subject:', error);
    
    // MongoDB duplicate key error
    if (error.code === 11000) {
      return json({
        success: false,
        message: 'Subject code already exists'
      }, { status: 409 });
    }
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({
        success: false,
        message: 'Database connection failed'
      }, { status: 503 });
    }
    
    return json({
      success: false,
      message: 'Failed to create subject: ' + error.message
    }, { status: 500 });
  }
}

// PUT /api/subjects - Update an existing subject
export async function PUT({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can update subjects
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const data = await request.json();
    const { id, name, code, gradeLevel, department_id } = data;
    
    // Validation
    if (!id || !name || !code || !gradeLevel) {
      return json({
        success: false,
        message: 'ID, name, code, and grade level are required'
      }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const subjectsCollection = db.collection('subjects');
    
    // Check if subject exists
    const existingSubject = await subjectsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!existingSubject) {
      return json({
        success: false,
        message: 'Subject not found'
      }, { status: 404 });
    }
    
    // Check if code is being changed and if new code already exists
    if (code !== existingSubject.code) {
      const codeExists = await subjectsCollection.findOne({ 
        code: code,
        _id: { $ne: new ObjectId(id) }
      });
      
      if (codeExists) {
        return json({
          success: false,
          message: 'Subject code already exists'
        }, { status: 409 });
      }
    }
    
    // Update subject document
    const updateData = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      grade_level: parseInt(gradeLevel),
      department_id: department_id || null,
      updated_at: new Date()
    };
    
    const result = await subjectsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return json({
        success: false,
        message: 'Subject not found'
      }, { status: 404 });
    }
    
    // Log the subject update activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // Create activity log with proper structure (matching accounts API)
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'subject_updated',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          id: id,
          name: updateData.name,
          code: updateData.code,
          grade_level: updateData.grade_level,
          previous_name: existingSubject.name,
          previous_code: existingSubject.code,
          previous_grade_level: existingSubject.grade_level
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging subject update activity:', logError);
      // Don't fail the subject update if logging fails
    }
    
    // Get updated subject with department info
    const updatedSubject = await subjectsCollection.findOne({ _id: new ObjectId(id) });
    let department = null;
    if (updatedSubject.department_id) {
      const departmentsCollection = db.collection('departments');
      department = await departmentsCollection.findOne({ _id: new ObjectId(updatedSubject.department_id) });
    }
    
    // Format response to match component structure
    const formattedSubject = {
      id: updatedSubject._id.toString(),
      name: updatedSubject.name,
      code: updatedSubject.code,
      grade_level: updatedSubject.grade_level,
      gradeLevel: `Grade ${updatedSubject.grade_level}`,
      department_id: updatedSubject.department_id,
      department_name: department?.name || null,
      department_code: department?.code || null,
      icon: 'book',
      createdDate: new Date(updatedSubject.created_at).toLocaleDateString('en-US'),
      updatedDate: new Date(updatedSubject.updated_at).toLocaleDateString('en-US')
    };
    
    return json({
      success: true,
      message: `Subject "${name}" updated successfully`,
      data: formattedSubject
    });
    
  } catch (error) {
    console.error('Error updating subject:', error);
    
    // MongoDB duplicate key error
    if (error.code === 11000) {
      return json({
        success: false,
        message: 'Subject code already exists'
      }, { status: 409 });
    }
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({
        success: false,
        message: 'Database connection failed'
      }, { status: 503 });
    }
    
    return json({
      success: false,
      message: 'Failed to update subject: ' + error.message
    }, { status: 500 });
  }
}

// DELETE /api/subjects - Delete a subject
export async function DELETE({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can delete subjects
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const data = await request.json();
    const { id } = data;
    
    if (!id) {
      return json({
        success: false,
        message: 'Subject ID is required'
      }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const subjectsCollection = db.collection('subjects');
    
    // Check if subject exists and get its code and name
    const existingSubject = await subjectsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!existingSubject) {
      return json({
        success: false,
        message: 'Subject not found'
      }, { status: 404 });
    }
    
    // Hard delete the subject
    const result = await subjectsCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return json({
        success: false,
        message: 'Subject not found'
      }, { status: 404 });
    }
    
    // Log the subject deletion activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // Create activity log with proper structure (matching accounts API)
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'subject_deleted',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          subject_code: existingSubject.code,
          subject_name: existingSubject.name,
          subject_id: id
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging subject deletion activity:', logError);
      // Don't fail the deletion if logging fails
    }
    
    return json({
      success: true,
      message: `Subject "${existingSubject.name} (${existingSubject.code})" has been removed successfully`
    });
    
  } catch (error) {
    console.error('Error deleting subject:', error);
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({
        success: false,
        message: 'Database connection failed'
      }, { status: 503 });
    }
    
    return json({
      success: false,
      message: 'Failed to delete subject: ' + error.message
    }, { status: 500 });
  }
}