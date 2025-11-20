import { json } from '@sveltejs/kit';
import { client } from '../../database/db.js';
import crypto from 'crypto';

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// POST /api/forgot-password - Request password reset code
export async function POST({ request }) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return json({ error: 'Email address is required' }, { status: 400 });
    }
    
    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return json({ error: 'Invalid email format' }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection('users');
    
    // Check if account with this email exists (case-insensitive)
    const user = await usersCollection.findOne({ 
      email: email.toLowerCase(),
      $or: [
        { status: { $exists: false } },
        { status: 'active' }
      ]
    });
    
    // For security, don't reveal if email exists or not
    // Always return success message
    if (!user) {
      // Still return success but don't send email
      return json({ 
        success: true, 
        message: 'If an account with this email exists, a password reset code has been sent.'
      });
    }
    
    // Generate 6-digit verification code
    const resetCode = crypto.randomInt(100000, 999999).toString();
    
    // Store reset code in database with 15-minute expiration
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          password_reset_code: resetCode,
          password_reset_token: resetToken,
          password_reset_expires: expiresAt,
          password_reset_attempts: 0,
          updated_at: new Date()
        }
      }
    );
    
    // Import and send email (async, don't wait)
    import('../helper/password-reset-email.js').then(({ sendPasswordResetEmail }) => {
      sendPasswordResetEmail({
        email: user.email,
        fullName: user.full_name,
        resetCode: resetCode,
        accountNumber: user.account_number
      }).catch(error => {
        console.error('Error sending password reset email:', error);
      });
    });
    
    return json({ 
      success: true,
      resetToken: resetToken,
      message: 'If an account with this email exists, a password reset code has been sent.'
    });
    
  } catch (error) {
    console.error('Error in forgot password:', error);
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    return json({ error: 'Failed to process password reset request' }, { status: 500 });
  }
}
