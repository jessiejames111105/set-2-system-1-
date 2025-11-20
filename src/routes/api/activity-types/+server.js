import { json } from '@sveltejs/kit';
import { client } from '../../database/db.js';
import { ObjectId } from 'mongodb';
import { getUserFromRequest, verifyAuth } from '../helper/auth-helper.js';

// Function to generate random colors
function getRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// GET /api/activity-types - Fetch all activity types with optional filtering
export async function GET({ url, request }) {
  try {
    // Verify authentication - admins, teachers, and advisers can view activity types
    const authResult = await verifyAuth(request, ['admin', 'teacher', 'adviser']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const searchTerm = url.searchParams.get('search') || '';
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const activityTypesCollection = db.collection('activity_types');
    
    // Build query filter
    let filter = {};
    if (searchTerm) {
      filter = {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { code: { $regex: searchTerm, $options: 'i' } }
        ]
      };
    }
    
    // Fetch activity types from MongoDB
    const activityTypes = await activityTypesCollection.find(filter).toArray();
    
    // Format response to match component structure
    const formattedActivityTypes = activityTypes.map(activity => ({
      id: activity._id.toString(),
      name: activity.name,
      code: activity.code,
      color: activity.color,
      icon: activity.icon,
      createdAt: activity.created_at,
      createdDate: new Date(activity.created_at).toLocaleDateString('en-US'),
      updatedDate: new Date(activity.updated_at || activity.created_at).toLocaleDateString('en-US')
    }));
    
    return json({
      success: true,
      data: formattedActivityTypes
    });
    
  } catch (error) {
    console.error('Error fetching activity types:', error);
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({
        success: false,
        message: 'Database connection failed'
      }, { status: 503 });
    }
    
    return json({
      success: false,
      message: 'Failed to fetch activity types: ' + error.message
    }, { status: 500 });
  }
}

// POST /api/activity-types - Create a new activity type
export async function POST({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can create activity types
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const data = await request.json();
    const { name, code, icon } = data;
    
    // Validation
    if (!name || !code) {
      return json({
        success: false,
        message: 'Name and code are required'
      }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const activityTypesCollection = db.collection('activity_types');
    
    // Check if activity type code already exists
    const existingActivity = await activityTypesCollection.findOne({ code: code.trim().toUpperCase() });
    
    if (existingActivity) {
      return json({
        success: false,
        message: 'Activity type code already exists'
      }, { status: 409 });
    }
    
    // Generate random color
    const randomColor = getRandomColor();
    
    // Create new activity type document
    const newActivityData = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      color: randomColor,
      icon: icon || 'event',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Insert new activity type
    const result = await activityTypesCollection.insertOne(newActivityData);
    
    if (!result.insertedId) {
      return json({
        success: false,
        message: 'Failed to create activity type'
      }, { status: 500 });
    }
    
    // Get the created activity type
    const newActivity = await activityTypesCollection.findOne({ _id: result.insertedId });
    
    // Log the activity type creation activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // Create activity log with proper structure (matching accounts API)
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'activity_type_created',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          name: newActivity.name,
          code: newActivity.code,
          color: newActivity.color,
          icon: newActivity.icon
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging activity type creation activity:', logError);
      // Don't fail the activity type creation if logging fails
    }
    
    // Format response to match component structure
    const formattedActivity = {
      id: newActivity._id.toString(),
      name: newActivity.name,
      code: newActivity.code,
      color: newActivity.color,
      icon: newActivity.icon,
      createdAt: newActivity.created_at,
      createdDate: new Date(newActivity.created_at).toLocaleDateString('en-US'),
      updatedDate: new Date(newActivity.updated_at).toLocaleDateString('en-US')
    };
    
    return json({
      success: true,
      message: 'Activity type created successfully',
      data: formattedActivity
    });
    
  } catch (error) {
    console.error('Error creating activity type:', error);
    
    // MongoDB duplicate key error
    if (error.code === 11000) {
      return json({
        success: false,
        message: 'Activity type code already exists'
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
      message: 'Failed to create activity type: ' + error.message
    }, { status: 500 });
  }
}

// PUT /api/activity-types - Update an existing activity type
export async function PUT({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can update activity types
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const data = await request.json();
    const { id, name, code, icon } = data;
    
    // Validation
    if (!id || !name || !code) {
      return json({
        success: false,
        message: 'ID, name, and code are required'
      }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const activityTypesCollection = db.collection('activity_types');
    
    // Check if activity type exists
    const existingActivity = await activityTypesCollection.findOne({ _id: new ObjectId(id) });
    
    if (!existingActivity) {
      return json({
        success: false,
        message: 'Activity type not found'
      }, { status: 404 });
    }
    
    // Check if code is being changed and if new code already exists
    if (existingActivity.code !== code) {
      const codeExists = await activityTypesCollection.findOne({ 
        code: code,
        _id: { $ne: new ObjectId(id) }
      });
      
      if (codeExists) {
        return json({
          success: false,
          message: 'Activity type code already exists'
        }, { status: 409 });
      }
    }
    
    // Update activity type document
    const updateData = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      icon: icon || existingActivity.icon,
      updated_at: new Date()
    };
    
    const result = await activityTypesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return json({
        success: false,
        message: 'Activity type not found'
      }, { status: 404 });
    }
    
    // Log the activity type update activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // Create activity log with proper structure (matching accounts API)
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'activity_type_updated',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          id: id,
          name: updateData.name,
          code: updateData.code,
          icon: updateData.icon,
          previous_name: existingActivity.name,
          previous_code: existingActivity.code,
          previous_icon: existingActivity.icon
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging activity type update activity:', logError);
      // Don't fail the activity type update if logging fails
    }
    
    // Get updated activity type
    const updatedActivity = await activityTypesCollection.findOne({ _id: new ObjectId(id) });
    
    // Format response to match component structure
    const formattedActivity = {
      id: updatedActivity._id.toString(),
      name: updatedActivity.name,
      code: updatedActivity.code,
      color: updatedActivity.color,
      icon: updatedActivity.icon,
      createdAt: updatedActivity.created_at,
      createdDate: new Date(updatedActivity.created_at).toLocaleDateString('en-US'),
      updatedDate: new Date(updatedActivity.updated_at).toLocaleDateString('en-US')
    };
    
    return json({
      success: true,
      message: `Activity type "${name}" updated successfully`,
      data: formattedActivity
    });
    
  } catch (error) {
    console.error('Error updating activity type:', error);
    
    // MongoDB duplicate key error
    if (error.code === 11000) {
      return json({
        success: false,
        message: 'Activity type code already exists'
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
      message: 'Failed to update activity type: ' + error.message
    }, { status: 500 });
  }
}

// DELETE /api/activity-types - Delete an activity type
export async function DELETE({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can delete activity types
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const data = await request.json();
    const { id } = data;
    
    // Validation
    if (!id) {
      return json({
        success: false,
        message: 'Activity type ID is required'
      }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const activityTypesCollection = db.collection('activity_types');
    
    // Check if activity type exists
    const existingActivity = await activityTypesCollection.findOne({ _id: new ObjectId(id) });
    
    if (!existingActivity) {
      return json({
        success: false,
        message: 'Activity type not found'
      }, { status: 404 });
    }
    
    // Delete activity type
    const result = await activityTypesCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return json({
        success: false,
        message: 'Activity type not found'
      }, { status: 404 });
    }
    
    // Log the activity type deletion activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // Create activity log with proper structure (matching accounts API)
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'activity_type_deleted',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          id: id,
          name: existingActivity.name,
          code: existingActivity.code,
          color: existingActivity.color,
          icon: existingActivity.icon
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging activity type deletion activity:', logError);
      // Don't fail the activity type deletion if logging fails
    }
    
    return json({
      success: true,
      message: `Activity type "${existingActivity.name}" deleted successfully`
    });
    
  } catch (error) {
    console.error('Error deleting activity type:', error);
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({
        success: false,
        message: 'Database connection failed'
      }, { status: 503 });
    }
    
    return json({
      success: false,
      message: 'Failed to delete activity type: ' + error.message
    }, { status: 500 });
  }
}