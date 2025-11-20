import { json } from '@sveltejs/kit';
import { client } from '../../../database/db.js';
import { verifyAuth } from '../../helper/auth-helper.js';

// Function to generate the next account number (same logic as in accounts/+server.js)
async function generateAccountNumber(accountType) {
  const currentYear = new Date().getFullYear();
  const prefix = accountType === 'student' ? 'STU' : 
                 accountType === 'teacher' ? 'TCH' : 
                 accountType === 'admin' ? 'ADM' : 'ACC';
  
  try {
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection('users');
    
    // Query all existing account numbers for this type and year (excluding archived)
    const existingAccounts = await usersCollection.find({
      account_number: { $regex: `^${prefix}-${currentYear}-` },
      status: { $ne: 'archived' }
    }).toArray();
    
    if (existingAccounts.length === 0) {
      return `${prefix}-${currentYear}-0001`;
    }
    
    // Extract the numeric parts and create a Set for O(1) lookup
    const existingNumbers = new Set(
      existingAccounts.map(account => {
        const parts = account.account_number.split('-');
        return parseInt(parts[2]);
      }).filter(num => !isNaN(num))
    );
    
    // Find the first available number starting from 1
    let nextNumber = 1;
    while (existingNumbers.has(nextNumber)) {
      nextNumber++;
    }
    
    return `${prefix}-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating account number:', error);
    throw error;
  }
}

// GET /api/accounts/next-number - Get the next available account number for preview
export async function GET({ url, request }) {
  try {
    // Verify authentication - only admins can get next account number
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const accountType = url.searchParams.get('type');
    
    if (!accountType) {
      return json({ error: 'Account type is required' }, { status: 400 });
    }
    
    if (!['student', 'teacher', 'admin'].includes(accountType)) {
      return json({ error: 'Invalid account type' }, { status: 400 });
    }
    
    const nextNumber = await generateAccountNumber(accountType);
    
    return json({ 
      accountNumber: nextNumber,
      accountType: accountType
    });
    
  } catch (error) {
    console.error('Error getting next account number:', error);
    return json({ error: 'Failed to get next account number' }, { status: 500 });
  }
}