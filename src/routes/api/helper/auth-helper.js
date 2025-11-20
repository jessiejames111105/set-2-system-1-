import { client } from '../../database/db.js';
import { ObjectId } from 'mongodb';

/**
 * Extract user information from request headers
 * @param {Request} request - The request object
 * @returns {Object} User information object
 */
export function getUserFromRequest(request) {
  const userHeader = request.headers.get('x-user-info');
  if (!userHeader) {
    return null;
  }
  
  try {
    return JSON.parse(userHeader);
  } catch (error) {
    console.error('Error parsing user header:', error);
    return null;
  }
}

/**
 * Log activity with user attribution using MongoDB
 * @param {string} activityType - The type of activity being performed
 * @param {string} description - Description of the action
 * @param {Object} user - User object from getUserFromRequest
 * @param {Object} [activityData] - Additional data about the activity
 * @param {string} [ipAddress] - IP address of the user
 */
export async function logActivityWithUser(activityType, description, user, activityData = {}, ipAddress = null) {
  try {
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const activityLogsCollection = db.collection('activity_logs');
    
    // Use ObjectId for user_id if it's a valid string ID
    let userId = null;
    if (user?.id) {
      try {
        userId = new ObjectId(user.id);
      } catch (e) {
        // If conversion fails, store as string
        userId = user.id;
      }
    }
    
    const logEntry = {
      activity_type: activityType,
      user_id: userId,
      user_account_number: user?.account_number || null,
      activity_data: {
        description,
        full_name: user?.name || user?.full_name || 'Unknown',
        account_type: user?.account_type || 'Unknown',
        ...activityData
      },
      ip_address: ipAddress,
      created_at: new Date()
    };
    
    await activityLogsCollection.insertOne(logEntry);
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error to prevent breaking the main operation
  }
}

/**
 * Verify authentication and authorization using MongoDB
 * @param {Request} request - The request object
 * @param {string[]} allowedRoles - Array of allowed account types
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export async function verifyAuth(request, allowedRoles = []) {
  try {
    const user = getUserFromRequest(request);
    
    if (!user || !user.id) {
      return { success: false, error: 'Authentication required' };
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection('users');
    
    // Verify user exists and get current account type
    const userRecord = await usersCollection.findOne(
      { _id: new ObjectId(user.id) },
      { projection: { account_type: 1, status: 1 } }
    );
    
    if (!userRecord) {
      return { success: false, error: 'User not found' };
    }
    
    if (userRecord.status === 'archived') {
      return { success: false, error: 'Account is archived' };
    }
    
    // Check if user has required role
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRecord.account_type)) {
      return { 
        success: false, 
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}` 
      };
    }
    
    // Update user object with current account type
    const updatedUser = {
      ...user,
      account_type: userRecord.account_type
    };
    
    return { success: true, user: updatedUser };
  } catch (error) {
    console.error('Error verifying authentication:', error);
    return { success: false, error: 'Authentication verification failed' };
  }
}