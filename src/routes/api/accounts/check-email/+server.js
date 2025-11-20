import { json } from '@sveltejs/kit';
import { client } from '../../../database/db.js';
import { verifyAuth } from '../../helper/auth-helper.js';

// Email validation regex - standard email format validation
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// GET /api/accounts/check-email?email=xxx - Check if email is already used
export async function GET({ url, request }) {
  try {
    // Verify authentication - only admins can check email availability
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const email = url.searchParams.get('email');
    
    if (!email) {
      return json({ error: 'Email parameter is required' }, { status: 400 });
    }
    
    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return json({ 
        valid: false,
        exists: false,
        available: false,
        error: 'Invalid email format'
      }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection('users');
    
    // Check if email exists (only in active accounts)
    const existingAccount = await usersCollection.findOne({ 
      email: email.toLowerCase(), // Case-insensitive email check
      $or: [
        { status: { $exists: false } },
        { status: 'active' }
      ]
    });
    
    return json({ 
      valid: true,
      exists: !!existingAccount,
      available: !existingAccount
    });
    
  } catch (error) {
    console.error('Error checking email:', error);
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    return json({ error: 'Failed to check email' }, { status: 500 });
  }
}
