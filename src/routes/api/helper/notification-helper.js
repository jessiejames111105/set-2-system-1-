import { ObjectId } from 'mongodb';

/**
 * Helper function to format teacher name as "Ms./Mr. [LastName]"
 * @param {string} fullName - Teacher's full name (format: "LastName, FirstName MiddleInitial.")
 * @param {string} gender - Teacher's gender ('male', 'female', or other)
 * @returns {string} Formatted teacher name
 */
export function formatTeacherName(fullName, gender = 'unknown') {
  if (!fullName) return 'Your teacher';
  
  // Handle format: "LastName, FirstName MiddleInitial."
  let lastName;
  if (fullName.includes(',')) {
    // Split by comma and take the first part as last name
    lastName = fullName.split(',')[0].trim();
  } else {
    // Fallback: assume last word is last name if no comma format
    const nameParts = fullName.trim().split(' ');
    lastName = nameParts[nameParts.length - 1];
  }
  
  // Determine title based on gender
  let title = 'Teacher'; // Default fallback
  if (gender === 'female') {
    title = 'Ms.';
  } else if (gender === 'male') {
    title = 'Mr.';
  } else {
    title = 'Teacher'; // For unknown or other genders
  }
  
  return `${title} ${lastName}`;
}

/**
 * Helper function to create grade verification notifications
 * @param {Object} db - MongoDB database instance
 * @param {string} studentId - Student ID
 * @param {string} teacherName - Formatted teacher name (e.g., "Ms. Smith")
 * @param {string} subjectName - Subject name
 */
export async function createGradeVerificationNotification(db, studentId, teacherName, subjectName) {
  try {
    const notificationTitle = `Your grade in ${subjectName} is now available`;
    const notificationMessage = `Your grade in ${subjectName} has been released by ${teacherName}. Check your grade report to see your performance.`;

    const notification = {
      student_id: studentId,
      title: notificationTitle,
      message: notificationMessage,
      type: 'grade',
      is_read: false,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null // System-generated notification
    };

    await db.collection('notifications').insertOne(notification);
    console.log(`Grade verification notification created for student: ${studentId}`);
  } catch (error) {
    console.error('Error creating grade verification notification:', error);
  }
}

/**
 * Helper function to create multiple grade verification notifications for a list of students
 * @param {Object} db - MongoDB database instance
 * @param {Array} studentIds - Array of student IDs
 * @param {string} teacherName - Formatted teacher name (e.g., "Ms. Smith")
 * @param {string} subjectName - Subject name
 */
export async function createBulkGradeVerificationNotifications(db, studentIds, teacherName, subjectName) {
  try {
    const notificationTitle = `Your grade in ${subjectName} is now available`;
    const notificationMessage = `Your grade in ${subjectName} has been released by ${teacherName}. Check your grade report to see your performance.`;

    const notifications = studentIds.map(studentId => ({
      student_id: studentId,
      title: notificationTitle,
      message: notificationMessage,
      type: 'grade',
      is_read: false,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null // System-generated notification
    }));

    if (notifications.length > 0) {
      await db.collection('notifications').insertMany(notifications);
      console.log(`Grade verification notifications created for ${notifications.length} students`);
    }
  } catch (error) {
    console.error('Error creating bulk grade verification notifications:', error);
  }
}

/**
 * Helper function to create document request status notifications
 * @param {Object} db - MongoDB database instance
 * @param {string} studentId - Student ID
 * @param {string} documentType - Type of document requested
 * @param {string} status - New status (processing, rejected, completed)
 * @param {string} adminNote - Optional admin note for processing status
 * @param {string} rejectionReason - Rejection reason for rejected status
 * @param {Object} adminUser - Optional admin user object who performed the action
 */
export async function createDocumentRequestNotification(db, studentId, documentType, status, adminNote = null, rejectionReason = null, adminUser = null) {
  try {
    let notificationTitle = '';
    let notificationMessage = '';
    let adminName = null;
    
    // Get full admin information from database if adminUser is provided
    if (adminUser && adminUser.id) {
      try {
        const usersCollection = db.collection('users');
        const adminRecord = await usersCollection.findOne(
          { _id: new ObjectId(adminUser.id) },
          { projection: { first_name: 1, last_name: 1, name: 1, username: 1 } }
        );
        
        if (adminRecord) {
          if (adminRecord.first_name && adminRecord.last_name) {
            adminName = `${adminRecord.first_name} ${adminRecord.last_name}`;
          } else if (adminRecord.name) {
            adminName = adminRecord.name;
          } else if (adminRecord.username) {
            adminName = adminRecord.username;
          } else {
            adminName = 'Admin';
          }
          console.log(`Found admin name: ${adminName} for user ID: ${adminUser.id}`);
        } else {
          console.log(`No admin record found for user ID: ${adminUser.id}`);
        }
      } catch (dbError) {
        console.error('Error fetching admin user data:', dbError);
        // Fallback to using provided user data
        if (adminUser.first_name && adminUser.last_name) {
          adminName = `${adminUser.first_name} ${adminUser.last_name}`;
        } else if (adminUser.name) {
          adminName = adminUser.name;
        } else if (adminUser.username) {
          adminName = adminUser.username;
        } else {
          adminName = 'Admin';
        }
      }
    }
    
    // Format document type for display
    const documentTypeMap = {
      'transcript': 'Transcript',
      'enrollment': 'Enrollment Certificate',
      'grade-report': 'Grade Report',
      'diploma': 'Diploma',
      'certificate': 'Certificate'
    };
    const formattedDocType = documentTypeMap[documentType] || documentType;

    switch (status) {
      case 'processing':
        notificationTitle = `Document request approved - Now processing`;
        notificationMessage = `Your ${formattedDocType} request has been approved and is now being processed.`;
        break;
      
      case 'rejected':
        notificationTitle = `Document request rejected`;
        notificationMessage = `Your ${formattedDocType} request has been rejected.`;
        break;
      
      case 'completed':
        notificationTitle = `Document request completed`;
        notificationMessage = `Your ${formattedDocType} request has been completed.`;
        break;
      
      default:
        console.warn(`Unknown document request status: ${status}`);
        return;
    }

    const notification = {
      student_id: studentId,
      title: notificationTitle,
      message: notificationMessage,
      type: 'document_request',
      is_read: false,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: adminUser ? adminUser.id : null,
      // Store admin note and rejection reason as separate fields
      admin_note: adminNote || null,
      rejection_reason: rejectionReason || null,
      document_type: documentType,
      status: status,
      // Store admin information
      admin_name: adminName,
      admin_id: adminUser ? adminUser.id : null
    };

    await db.collection('notifications').insertOne(notification);
    console.log(`Document request notification created for student: ${studentId}, status: ${status}`);
  } catch (error) {
    console.error('Error creating document request notification:', error);
  }
}