import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import bcrypt from 'bcrypt';

// Global login attempts tracking
// Structure: { attempts: number, lockedUntil: Date | null }
let globalLoginAttempts = { attempts: 0, lockedUntil: null };

// Constants
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Check if login is currently locked out globally
 * @returns {Object} { isLocked: boolean, remainingTime: number, attemptsLeft: number }
 */
function checkLoginAttempts() {
  // Check if lockout period has expired
  if (globalLoginAttempts.lockedUntil && new Date() >= globalLoginAttempts.lockedUntil) {
    // Reset attempts after lockout expires
    globalLoginAttempts = { attempts: 0, lockedUntil: null };
    return { isLocked: false, remainingTime: 0, attemptsLeft: MAX_LOGIN_ATTEMPTS };
  }
  
  // If still locked
  if (globalLoginAttempts.lockedUntil) {
    const remainingTime = Math.ceil((globalLoginAttempts.lockedUntil - new Date()) / 1000); // in seconds
    return { isLocked: true, remainingTime, attemptsLeft: 0 };
  }
  
  // Not locked but has attempts
  const attemptsLeft = MAX_LOGIN_ATTEMPTS - globalLoginAttempts.attempts;
  return { isLocked: false, remainingTime: 0, attemptsLeft };
}

/**
 * Record a failed login attempt globally
 */
function recordFailedAttempt() {
  globalLoginAttempts.attempts += 1;
  
  // Lock login if max attempts reached
  if (globalLoginAttempts.attempts >= MAX_LOGIN_ATTEMPTS) {
    globalLoginAttempts.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }
  
  return MAX_LOGIN_ATTEMPTS - globalLoginAttempts.attempts;
}

/**
 * Clear global login attempts (called on successful login)
 */
function clearLoginAttempts() {
  globalLoginAttempts = { attempts: 0, lockedUntil: null };
}

// POST /api/auth - Authenticate user with account number and password
export async function POST({ request, getClientAddress }) {
  try {
    const { accountNumber, password } = await request.json();
    
    // Validate required fields
    if (!accountNumber || !password) {
      return json({ error: 'Account number and password are required' }, { status: 400 });
    }
    
    // Additional input validation and sanitization
    if (typeof accountNumber !== 'string' || typeof password !== 'string') {
      return json({ error: 'Invalid input format' }, { status: 400 });
    }
    
    // Sanitize account number (remove any non-alphanumeric characters except hyphens and underscores)
    const sanitizedAccountNumber = accountNumber.replace(/[^a-zA-Z0-9\-_]/g, '');
    
    if (sanitizedAccountNumber !== accountNumber || accountNumber.length > 50) {
      return json({ error: 'Invalid account number format' }, { status: 400 });
    }
    
    if (password.length > 200) {
      return json({ error: 'Password too long' }, { status: 400 });
    }
    
    // Check if login is locked globally due to too many failed attempts
    const attemptStatus = checkLoginAttempts();
    if (attemptStatus.isLocked) {
      const minutes = Math.floor(attemptStatus.remainingTime / 60);
      const seconds = attemptStatus.remainingTime % 60;
      const timeString = minutes > 0 
        ? `${minutes} minute${minutes > 1 ? 's' : ''} and ${seconds} second${seconds > 1 ? 's' : ''}`
        : `${seconds} second${seconds > 1 ? 's' : ''}`;
      
      return json({ 
        error: `Login temporarily unavailable due to too many failed attempts. Please try again in ${timeString}.`,
        isLocked: true,
        remainingTime: attemptStatus.remainingTime
      }, { status: 429 });
    }
    
    // Query user by account number from MongoDB
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    
    // Optimized query: check account_number first (indexed), then filter status
    const user = await usersCollection.findOne({
      account_number: sanitizedAccountNumber,
      status: { $ne: 'archived' } // Simpler condition: not archived = active/null/undefined
    });
    
    if (!user) {
      // Record failed attempt globally
      const attemptsLeft = recordFailedAttempt();
      
      if (attemptsLeft > 0) {
        return json({ 
          error: 'Invalid account number or password',
          attemptsLeft
        }, { status: 401 });
      } else {
        return json({ 
          error: 'Invalid account number or password. Login has been locked for 10 minutes due to too many failed attempts.',
          isLocked: true,
          attemptsLeft: 0
        }, { status: 429 });
      }
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      // Record failed attempt globally
      const attemptsLeft = recordFailedAttempt();
      
      if (attemptsLeft > 0) {
        return json({ 
          error: 'Invalid account number or password',
          attemptsLeft
        }, { status: 401 });
      } else {
        return json({ 
          error: 'Invalid account number or password. Login has been locked for 10 minutes due to too many failed attempts.',
          isLocked: true,
          attemptsLeft: 0
        }, { status: 429 });
      }
    }
    
    // Clear global login attempts on successful authentication
    clearLoginAttempts();
    
    // Return user data (excluding password hash)
    const userData = {
      id: user._id,
      name: user.full_name,
      firstName: user.first_name,
      gender: user.gender,
      accountNumber: user.account_number,
      accountType: user.account_type
    };
    
    // Log the login activity asynchronously (only for admin users)
    if (user.account_type === 'admin') {
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      const activityLogsCollection = db.collection('activity_logs');
      
      // Fire and forget - log activity without blocking the response
      activityLogsCollection.insertOne({
        activity_type: 'user_login',
        user_id: user._id,
        user_account_number: user.account_number,
        activity_data: {
          full_name: user.full_name,
          account_type: user.account_type
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      }).catch(logError => {
        console.error('Error logging login activity:', logError);
        // Activity logging failure doesn't affect login success
      });
    }
    
    return json({ 
      success: true, 
      user: userData,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    // Generic error
    return json({ error: 'Authentication failed. Please try again.' }, { status: 500 });
  }
}