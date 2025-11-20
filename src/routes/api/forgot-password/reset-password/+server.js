import { json } from '@sveltejs/kit';
import { client } from '../../../database/db.js';
import bcrypt from 'bcrypt';

// POST /api/forgot-password/reset-password - Reset password with verified code
export async function POST({ request, getClientAddress }) {
  try {
    const { resetToken, code, newPassword } = await request.json();
    
    if (!resetToken || !code || !newPassword) {
      return json({ error: 'Reset token, code, and new password are required' }, { status: 400 });
    }
    
    // Validate password strength
    if (newPassword.length < 6) {
      return json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection('users');
    
    // Find user with this reset token
    const user = await usersCollection.findOne({ 
      password_reset_token: resetToken,
      password_reset_code: code,
      $or: [
        { status: { $exists: false } },
        { status: 'active' }
      ]
    });
    
    if (!user) {
      return json({ error: 'Invalid reset token or code' }, { status: 400 });
    }
    
    // Check if token has expired
    if (!user.password_reset_expires || new Date() > new Date(user.password_reset_expires)) {
      // Clean up expired reset data
      await usersCollection.updateOne(
        { _id: user._id },
        { 
          $unset: { 
            password_reset_code: '',
            password_reset_token: '',
            password_reset_expires: '',
            password_reset_attempts: ''
          }
        }
      );
      return json({ error: 'Reset code has expired. Please request a new one.' }, { status: 400 });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password and clear reset data
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          password_hash: hashedPassword,
          updated_at: new Date()
        },
        $unset: { 
          password_reset_code: '',
          password_reset_token: '',
          password_reset_expires: '',
          password_reset_attempts: ''
        }
      }
    );
    
    // Log password reset activity
    try {
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'password_reset',
        user_id: user._id,
        user_account_number: user.account_number,
        activity_data: {
          account_type: user.account_type,
          full_name: user.full_name,
          reset_method: 'email_verification'
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging password reset activity:', logError);
      // Don't fail the password reset if logging fails
    }
    
    // Send confirmation email (async, don't wait)
    import('../../helper/password-reset-email.js').then(({ sendPasswordResetConfirmationEmail }) => {
      sendPasswordResetConfirmationEmail({
        email: user.email,
        fullName: user.full_name,
        accountNumber: user.account_number
      }).catch(error => {
        console.error('Error sending password reset confirmation email:', error);
      });
    });
    
    return json({ 
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    return json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
