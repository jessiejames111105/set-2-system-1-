import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { verifyAuth } from '../helper/auth-helper.js';

// GET /api/dashboard - Fetch dashboard statistics
export async function GET({ request }) {
  try {
    // Verify authentication - admins, teachers, and advisers can view dashboard statistics
    const authResult = await verifyAuth(request, ['admin', 'teacher', 'adviser']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    // Connect to MongoDB
    const db = await connectToDatabase();
    
    // Get total students count
    const studentsCount = await db.collection('users').countDocuments({
      account_type: 'student',
      $or: [
        { status: { $exists: false } },
        { status: 'active' }
      ]
    });
    
    // Get total teachers count
    const teachersCount = await db.collection('users').countDocuments({
      account_type: 'teacher',
      $or: [
        { status: { $exists: false } },
        { status: 'active' }
      ]
    });
    
    // Get total sections count
    const sectionsCount = await db.collection('sections').countDocuments({
      status: 'active'
    });
    
    // Get total rooms count
    const roomsCount = await db.collection('rooms').countDocuments({});
    
    const statistics = {
      students: studentsCount,
      teachers: teachersCount,
      sections: sectionsCount,
      rooms: roomsCount
    };
    
    return json({ 
      success: true, 
      data: statistics 
    });
    
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    return json({ 
      success: false, 
      error: 'Failed to fetch dashboard statistics' 
    }, { status: 500 });
  }
}