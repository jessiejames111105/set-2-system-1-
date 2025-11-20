import { json } from '@sveltejs/kit';
import { client } from '../../database/db.js';
import bcrypt from 'bcrypt';
import { getUserFromRequest, logActivityWithUser, verifyAuth } from '../helper/auth-helper.js';
import { sendAccountCreationEmail } from '../helper/account-creation-email.js';
import { ObjectId } from 'mongodb';

// Email validation regex - standard email format validation
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// POST /api/accounts - Create a new account
export async function POST({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can create accounts
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const { accountType, gender, gradeLevel, firstName, lastName, middleInitial, email, birthdate, address, guardian, contactNumber, createdBy } = await request.json();
    
    // Validate required fields
    if (!accountType || !gender || !firstName || !lastName) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Validate email for students and teachers
    if ((accountType === 'student' || accountType === 'teacher') && !email) {
      return json({ error: 'Email is required for students and teachers' }, { status: 400 });
    }
    
    // Validate email format
    if (email && !EMAIL_REGEX.test(email)) {
      return json({ error: 'Invalid email format' }, { status: 400 });
    }
    
    // Check if email already exists (case-insensitive)
    if (email) {
      const db = client.db(process.env.MONGODB_DB_NAME);
      const usersCollection = db.collection('users');
      const existingEmail = await usersCollection.findOne({ 
        email: email.toLowerCase(),
        $or: [
          { status: { $exists: false } },
          { status: 'active' }
        ]
      });
      
      if (existingEmail) {
        return json({ error: 'This email is already registered' }, { status: 409 });
      }
    }
    
    // Validate grade level for students
    if (accountType === 'student' && !gradeLevel) {
      return json({ error: 'Grade level is required for students' }, { status: 400 });
    }
    
    // Validate additional information for students
    if (accountType === 'student') {
      if (!birthdate || !address || !guardian || !contactNumber) {
        return json({ error: 'Birthdate, address, guardian, and contact number are required for students' }, { status: 400 });
      }
    }
    
    // Calculate age from birthdate for students
    let age = null;
    if (accountType === 'student' && birthdate) {
      const birthDate = new Date(birthdate);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }
    
    // Generate account number
    const accountNumber = await generateAccountNumber(accountType);
    
    // Hash password (using account number as password)
    const hashedPassword = await bcrypt.hash(accountNumber, 10);
    
    // Construct full name
    const fullName = `${lastName}, ${firstName}${middleInitial ? ' ' + middleInitial + '.' : ''}`;
    
    // Connect to MongoDB and insert document
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection('users');
    
    // Create user document
    const userDoc = {
      account_number: accountNumber,
      account_type: accountType,
      first_name: firstName,
      last_name: lastName,
      middle_initial: middleInitial || null,
      full_name: fullName,
      gender: gender,
      email: email ? email.toLowerCase() : null, // Store email in lowercase
      grade_level: gradeLevel || null,
      birthdate: birthdate ? new Date(birthdate) : null,
      address: address || null,
      age: age,
      guardian: guardian || null,
      contact_number: contactNumber || null,
      password_hash: hashedPassword,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await usersCollection.insertOne(userDoc);
    const newAccount = { 
      id: result.insertedId.toString(),
      account_number: accountNumber,
      full_name: fullName,
      account_type: accountType,
      created_at: userDoc.created_at,
      updated_at: userDoc.updated_at
    };
    
    // Log the account creation activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // For MongoDB, we'll create a simple activity log collection
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'account_created',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          account_type: accountType,
          full_name: fullName,
          account_number: newAccount.account_number,
          grade_level: gradeLevel
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging account creation activity:', logError);
      // Don't fail the account creation if logging fails
    }
    
    // Format response to match frontend expectations
    const response = {
      id: newAccount.id,
      name: newAccount.full_name,
      type: accountType === 'student' ? 'Student' : accountType === 'teacher' ? 'Teacher' : 'Admin',
      number: newAccount.account_number,
      createdDate: new Date(newAccount.created_at).toLocaleDateString('en-US'),
      updatedDate: new Date(newAccount.updated_at).toLocaleDateString('en-US'),
      status: 'active'
    };
    
    // Send account creation email (don't block the response if email fails)
    if (email) {
      sendAccountCreationEmail({
        email: email,
        fullName: fullName,
        accountNumber: accountNumber,
        accountType: accountType
      }).then(emailResult => {
        if (emailResult.success) {
          console.log(`Account creation email sent to ${email}`);
        } else {
          console.error(`Failed to send account creation email to ${email}:`, emailResult.error);
        }
      }).catch(emailError => {
        console.error(`Error sending account creation email to ${email}:`, emailError);
      });
    }
    
    return json({ success: true, account: response, emailSent: !!email }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating account:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) { // Duplicate key error
      if (error.keyPattern && error.keyPattern.email) {
        return json({ error: 'An account with this email already exists' }, { status: 409 });
      }
      if (error.keyPattern && error.keyPattern.account_number) {
        return json({ error: 'Account number already exists' }, { status: 409 });
      }
    }
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    // Generic error
    return json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }
}

// GET /api/accounts - Fetch all accounts
export async function GET({ url, request }) {
  try {
    // Verify authentication - admins can view all accounts, teachers/advisers can view students
    const authResult = await verifyAuth(request, ['admin', 'teacher', 'adviser']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    const user = authResult.user;
    
    const limit = url.searchParams.get('limit'); // Get limit parameter but don't set default
    const type = url.searchParams.get('type'); // Get the type parameter
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection('users');
    
    // Build the query filter
    let filter = { 
      $or: [
        { status: { $exists: false } },
        { status: 'active' }
      ]
    };
    
    // Authorization: Teachers and advisers can only view student accounts
    if (user.account_type === 'teacher' || user.account_type === 'adviser') {
      filter.account_type = 'student';
    } else if (type) {
      // Admins can filter by type
      filter.account_type = type;
    }
    
    let accounts;
    
    // For teacher accounts, use aggregation to get department info
    if (type === 'teacher') {
      const pipeline = [
        { $match: filter },
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
          $addFields: {
            // Get the first department name if available
            department_name: { 
              $arrayElemAt: ['$departments.name', 0] 
            }
          }
        },
        { $sort: { created_at: -1 } }
      ];
      
      // Only apply limit if explicitly provided
      if (limit && !isNaN(parseInt(limit))) {
        pipeline.push({ $limit: parseInt(limit) });
      }
      
      accounts = await usersCollection.aggregate(pipeline).toArray();
    } else {
      let query = usersCollection
        .find(filter)
        .sort({ created_at: -1 });
      
      // Only apply limit if explicitly provided
      if (limit && !isNaN(parseInt(limit))) {
        query = query.limit(parseInt(limit));
      }
      
      accounts = await query.toArray();
    }
    
    // Get all sections to check for advisory assignments (for teachers)
    const sectionsCollection = db.collection('sections');
    const activeSections = await sectionsCollection.find({ 
      status: 'active' 
    }).toArray();
    
    // Create a map of adviser_id to section for quick lookup
    const adviserSectionMap = new Map();
    activeSections.forEach(section => {
      if (section.adviser_id) {
        adviserSectionMap.set(section.adviser_id.toString(), {
          name: section.name,
          grade_level: section.grade_level
        });
      }
    });
    
    // Format the data to match frontend expectations
    const formattedAccounts = accounts.map(account => {
      const accountId = account._id.toString();
      const advisorySection = adviserSectionMap.get(accountId);
      
      return {
        id: accountId,
        name: account.full_name,
        firstName: account.first_name,
        lastName: account.last_name,
        middleInitial: account.middle_initial,
        email: account.email,
        type: account.account_type === 'student' ? 'Student' : account.account_type === 'teacher' ? 'Teacher' : 'Admin',
        number: account.account_number,
        gradeLevel: account.grade_level,
        birthdate: account.birthdate,
        address: account.address,
        age: account.age,
        guardian: account.guardian,
        contactNumber: account.contact_number,
        department: account.department_name || null, // Add department field for teachers
        advisorySection: advisorySection ? `${advisorySection.name} (Grade ${advisorySection.grade_level})` : null,
        createdDate: new Date(account.created_at).toLocaleDateString('en-US'),
        updatedDate: new Date(account.updated_at).toLocaleDateString('en-US'),
        status: 'active'
      };
    });
    
    return json({ success: true, accounts: formattedAccounts });
    
  } catch (error) {
    console.error('Error fetching accounts:', error);
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    return json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

// PUT /api/accounts - Update an existing account
export async function PUT({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can update accounts
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const { id, firstName, lastName, middleInitial, gradeLevel, birthdate, address, guardian, contactNumber } = await request.json();
    
    // Validate required fields
    if (!id || !firstName || !lastName) {
      return json({ error: 'Account ID, first name, and last name are required' }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection('users');
    
    // Check if account exists and get its type
    const existingAccount = await usersCollection.findOne({ _id: new ObjectId(id) });
    
    if (!existingAccount) {
      return json({ error: 'Account not found' }, { status: 404 });
    }
    
    const accountType = existingAccount.account_type;
    const oldFullName = existingAccount.full_name;
    
    // Validate additional information for students
    if (accountType === 'student') {
      if (!birthdate || !address || !guardian || !contactNumber) {
        return json({ error: 'Birthdate, address, guardian, and contact number are required for students' }, { status: 400 });
      }
    }
    
    // Calculate age from birthdate for students
    let age = null;
    if (accountType === 'student' && birthdate) {
      const birthDate = new Date(birthdate);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }
    
    // Construct full name
    const fullName = `${lastName}, ${firstName}${middleInitial ? ' ' + middleInitial + '.' : ''}`;
    
    // Prepare update document based on account type
    let updateDoc = {
      first_name: firstName,
      last_name: lastName,
      middle_initial: middleInitial || null,
      full_name: fullName,
      updated_at: new Date()
    };

    if (accountType === 'student') {
      // Update with grade_level and additional information for student accounts
      updateDoc = {
        ...updateDoc,
        grade_level: gradeLevel || null,
        birthdate: birthdate ? new Date(birthdate) : null,
        address: address || null,
        age: age,
        guardian: guardian || null,
        contact_number: contactNumber || null
      };
    }
    
    // Update the document in MongoDB
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );
    
    if (result.matchedCount === 0) {
      return json({ error: 'Account not found' }, { status: 404 });
    }
    
    // Get the updated document
    const updatedAccount = await usersCollection.findOne({ _id: new ObjectId(id) });
    
    // Log the account update activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // For MongoDB, we'll create a simple activity log collection
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'account_updated',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          account_type: updatedAccount.account_type,
          old_full_name: oldFullName,
          full_name: updatedAccount.full_name,
          account_number: updatedAccount.account_number
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging account update activity:', logError);
      // Don't fail the update if logging fails
    }
    
    // Format response to match frontend expectations
    const response = {
      id: updatedAccount._id.toString(),
      name: updatedAccount.full_name,
      firstName: updatedAccount.first_name,
      lastName: updatedAccount.last_name,
      middleInitial: updatedAccount.middle_initial,
      type: updatedAccount.account_type === 'student' ? 'Student' : updatedAccount.account_type === 'teacher' ? 'Teacher' : 'Admin',
      number: updatedAccount.account_number,
      gradeLevel: updatedAccount.grade_level,
      birthdate: updatedAccount.birthdate,
      address: updatedAccount.address,
      age: updatedAccount.age,
      guardian: updatedAccount.guardian,
      contactNumber: updatedAccount.contact_number,
      createdDate: new Date(updatedAccount.created_at).toLocaleDateString('en-US'),
      updatedDate: new Date(updatedAccount.updated_at).toLocaleDateString('en-US'),
      status: 'active'
    };
    
    return json({ 
      success: true, 
      message: `Account for "${updatedAccount.full_name}" has been updated successfully`,
      account: response 
    });
    
  } catch (error) {
    console.error('Error updating account:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) { // Duplicate key error
      if (error.keyPattern && error.keyPattern.email) {
        return json({ error: 'An account with this email already exists' }, { status: 409 });
      }
    }
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    // Generic error
    return json({ error: 'Failed to update account. Please try again.' }, { status: 500 });
  }
}

// DELETE /api/accounts - Delete an account by ID
export async function DELETE({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can delete accounts
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const { id } = await request.json();
    
    if (!id) {
      return json({ error: 'Account ID is required' }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection('users');
    
    // Check if account exists
    const account = await usersCollection.findOne({ _id: new ObjectId(id) });
    
    if (!account) {
      return json({ error: 'Account not found' }, { status: 404 });
    }
    
    // Delete the account permanently
    const deleteResult = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (deleteResult.deletedCount === 0) {
      return json({ error: 'Failed to delete account' }, { status: 500 });
    }
    
    // Log the account deletion activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // For MongoDB, we'll create a simple activity log collection
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'account_deleted',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          account_type: account.account_type,
          full_name: account.full_name,
          account_number: account.account_number
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging account deletion activity:', logError);
      // Don't fail the deletion if logging fails
    }
    
    const accountTypeLabel = account.account_type === 'student' ? 'Student' : 
                            account.account_type === 'teacher' ? 'Teacher' : 'Admin';
    return json({
      success: true,
      message: `${accountTypeLabel} "${account.full_name}" has been deleted successfully`
    });
    
  } catch (error) {
    console.error('Error deleting account:', error);
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    return json({ error: 'Failed to delete account. Please try again.' }, { status: 500 });
  }
}

// Helper function to generate account numbers
async function generateAccountNumber(accountType) {
  const prefix = accountType === 'student' ? 'STU' : accountType === 'teacher' ? 'TCH' : 'ADM';
  const year = new Date().getFullYear();
  
  // Connect to MongoDB
  const db = client.db(process.env.MONGODB_DB_NAME);
  const usersCollection = db.collection('users');
  
  // Get all existing account numbers for this type and year (including archived accounts)
  const existingAccounts = await usersCollection.find({
    account_number: { $regex: `^${prefix}-${year}-` }
  }).toArray();
  
  // Extract the numeric parts and create a Set for O(1) lookup
  const existingNumbers = new Set(
    existingAccounts.map(account => {
      const match = account.account_number.match(/-(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    }).filter(num => num > 0) // Filter out invalid numbers
  );
  
  // Find the lowest available number starting from 1
  let nextNumber = 1;
  while (existingNumbers.has(nextNumber)) {
    nextNumber++;
  }
  
  return `${prefix}-${year}-${nextNumber.toString().padStart(4, '0')}`;
}

// PATCH /api/accounts - Archive an account (student or teacher) by ID
export async function PATCH({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can archive accounts
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const { id, action } = await request.json();
    
    if (!id) {
      return json({ error: 'Account ID is required' }, { status: 400 });
    }
    
    if (action !== 'archive') {
      return json({ error: 'Invalid action. Only "archive" is supported.' }, { status: 400 });
    }
    
    // Connect to MongoDB
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection('users');
    
    // Check if account exists and is a student or teacher
    const account = await usersCollection.findOne({ _id: new ObjectId(id) });
    
    if (!account) {
      return json({ error: 'Account not found' }, { status: 404 });
    }
    
    if (account.account_type !== 'student' && account.account_type !== 'teacher') {
      return json({ error: 'Only student and teacher accounts can be archived' }, { status: 400 });
    }
    
    // Archive the account
    const updateResult = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'archived',
          archived_at: new Date(),
          updated_at: new Date()
        }
      }
    );
    
    if (updateResult.matchedCount === 0) {
      return json({ error: 'Account not found' }, { status: 404 });
    }
    
    // Determine activity type based on account type
    const activityType = account.account_type === 'student' ? 'student_archived' : 'teacher_archived';
    const accountTypeLabel = account.account_type === 'student' ? 'Student' : 'Teacher';
    
    // Log the account archiving activity with user information
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // Create activity log with proper structure
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: activityType,
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.account_number || null,
        activity_data: {
          account_type: account.account_type,
          full_name: account.full_name,
          account_number: account.account_number
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging account archiving activity:', logError);
      // Don't fail the archiving if logging fails
    }
    
    return json({
      success: true,
      message: `${accountTypeLabel} "${account.full_name}" has been archived successfully`
    });
    
  } catch (error) {
    console.error('Error archiving account:', error);
    
    // MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerError') {
      return json({ error: 'Database connection failed. Please try again.' }, { status: 503 });
    }
    
    return json({ error: 'Failed to archive account. Please try again.' }, { status: 500 });
  }
}