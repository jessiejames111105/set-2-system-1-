import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { verifyAuth, logActivityWithUser, getUserFromRequest } from '../helper/auth-helper.js';
import { ObjectId } from 'mongodb';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, request }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const user = authResult.user;
    const studentId = url.searchParams.get('student_id') || user.id;
    const type = url.searchParams.get('type'); // Filter by notification type
    const isRead = url.searchParams.get('is_read'); // Filter by read status
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    // Connect to MongoDB
    const db = await connectToDatabase();
    const notificationsCollection = db.collection('notifications');

    // Build MongoDB filter
    const filter = { student_id: studentId };

    if (type) {
      filter.type = type;
    }

    if (isRead !== null && isRead !== undefined) {
      filter.is_read = isRead === 'true';
    }

    // Get notifications with pagination
    const notifications = await notificationsCollection
      .find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const totalCount = await notificationsCollection.countDocuments(filter);

    // Format notifications
    const formattedNotifications = notifications.map(notification => ({
      id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      isRead: notification.is_read,
      relatedId: notification.related_id,
      timestamp: notification.created_at.toISOString(),
      updatedAt: notification.updated_at.toISOString(),
      // Add document request specific fields
      adminNote: notification.admin_note || null,
      rejectionReason: notification.rejection_reason || null,
      documentType: notification.document_type || null,
      status: notification.status || null,
      adminName: notification.admin_name || null,
      adminId: notification.admin_id || null
    }));

    // Get unread count
    const unreadCount = await notificationsCollection.countDocuments({
      student_id: studentId,
      is_read: false
    });

    return json({
      success: true,
      data: {
        notifications: formattedNotifications,
        pagination: {
          total: totalCount,
          limit: limit,
          offset: offset,
          hasMore: offset + limit < totalCount
        },
        unreadCount: unreadCount
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return json({ 
      success: false, 
      error: 'Failed to fetch notifications' 
    }, { status: 500 });
  }
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ request }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const user = authResult.user;
    const requestBody = await request.json();
    const { id, action, ids } = requestBody;

    // Connect to MongoDB
    const db = await connectToDatabase();
    const notificationsCollection = db.collection('notifications');

    if (action === 'mark_read' && id) {
      // First check if notification exists and belongs to user
      const existingNotification = await notificationsCollection.findOne({
        _id: new ObjectId(id), 
        student_id: user.id 
      });
      
      if (!existingNotification) {
        return json({ 
          error: 'Notification not found or access denied' 
        }, { status: 404 });
      }

      // Mark single notification as read
      const result = await notificationsCollection.findOneAndUpdate(
        { _id: new ObjectId(id), student_id: user.id },
        { 
          $set: { 
            is_read: true, 
            updated_at: new Date() 
          } 
        },
        { returnDocument: 'after' }
      );

      // Use existing notification if update didn't return a result (already read)
      const updatedNotification = result.value || { ...existingNotification, is_read: true, updated_at: new Date() };

      // Log activity
      await logActivityWithUser(
        'notification_read',
        `Marked notification as read: ${updatedNotification.title}`,
        user,
        request.headers.get('x-forwarded-for') || 'unknown'
      );

      return json({
        success: true,
        data: {
          id: updatedNotification._id.toString(),
          isRead: updatedNotification.is_read
        }
      });
    }

    if (action === 'mark_unread' && id) {
      // First check if notification exists and belongs to user
      const existingNotification = await notificationsCollection.findOne({
        _id: new ObjectId(id), 
        student_id: user.id 
      });

      if (!existingNotification) {
        return json({ 
          error: 'Notification not found or access denied' 
        }, { status: 404 });
      }

      // Mark single notification as unread
      const result = await notificationsCollection.findOneAndUpdate(
        { _id: new ObjectId(id), student_id: user.id },
        { 
          $set: { 
            is_read: false, 
            updated_at: new Date() 
          } 
        },
        { returnDocument: 'after' }
      );

      // Use existing notification if update didn't return a result (already unread)
      const updatedNotification = result.value || { ...existingNotification, is_read: false, updated_at: new Date() };

      return json({
        success: true,
        data: {
          id: updatedNotification._id.toString(),
          isRead: updatedNotification.is_read
        }
      });
    }

    if (action === 'mark_all_read') {
      // Mark all notifications as read for the user
      const result = await notificationsCollection.updateMany(
        { student_id: user.id, is_read: false },
        { 
          $set: { 
            is_read: true, 
            updated_at: new Date() 
          } 
        }
      );

      // Log activity
      await logActivityWithUser(
        'notifications_mark_all_read',
        `Marked ${result.modifiedCount} notifications as read`,
        user,
        request.headers.get('x-forwarded-for') || 'unknown'
      );

      return json({
        success: true,
        data: {
          updatedCount: result.modifiedCount
        }
      });
    }

    if (action === 'bulk_mark_read' && ids && Array.isArray(ids)) {
      // Mark multiple notifications as read
      const objectIds = ids.map(id => new ObjectId(id));
      const result = await notificationsCollection.updateMany(
        { 
          student_id: user.id, 
          _id: { $in: objectIds } 
        },
        { 
          $set: { 
            is_read: true, 
            updated_at: new Date() 
          } 
        }
      );

      return json({
        success: true,
        data: {
          updatedIds: ids,
          updatedCount: result.modifiedCount
        }
      });
    }

    return json({ 
      error: 'Invalid action or missing parameters' 
    }, { status: 400 });

  } catch (error) {
    console.error('Error updating notification:', error);
    return json({ 
      success: false, 
      error: 'Failed to update notification' 
    }, { status: 500 });
  }
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ request }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const user = authResult.user;
    const { id, ids, action } = await request.json();

    // Connect to MongoDB
    const db = await connectToDatabase();
    const notificationsCollection = db.collection('notifications');

    if (action === 'delete_read') {
      // Delete all read notifications for the user
      const result = await notificationsCollection.deleteMany({
        student_id: user.id,
        is_read: true
      });

      // Log activity
      await logActivityWithUser(
        'notifications_delete_read',
        `Deleted ${result.deletedCount} read notifications`,
        user,
        request.headers.get('x-forwarded-for') || 'unknown'
      );

      return json({
        success: true,
        data: {
          deletedCount: result.deletedCount,
          message: 'All read notifications deleted successfully'
        }
      });
    }

    if (id) {
      // First check if notification exists and belongs to user
      const existingNotification = await notificationsCollection.findOne({
        _id: new ObjectId(id),
        student_id: user.id
      });

      if (!existingNotification) {
        return json({ 
          error: 'Notification not found or access denied' 
        }, { status: 404 });
      }

      // Delete single notification
      const result = await notificationsCollection.findOneAndDelete({
        _id: new ObjectId(id),
        student_id: user.id
      });

      // Log activity
      await logActivityWithUser(
        'notification_delete',
        `Deleted notification: ${existingNotification.title}`,
        user,
        request.headers.get('x-forwarded-for') || 'unknown'
      );

      return json({
        success: true,
        data: {
          message: 'Notification deleted successfully'
        }
      });
    }

    if (ids && Array.isArray(ids)) {
      // Delete multiple notifications
      const objectIds = ids.map(id => new ObjectId(id));
      const result = await notificationsCollection.deleteMany({
        student_id: user.id,
        _id: { $in: objectIds }
      });

      return json({
        success: true,
        data: {
          deletedIds: ids,
          deletedCount: result.deletedCount,
          message: 'Notifications deleted successfully'
        }
      });
    }

    return json({ 
      error: 'Notification ID or IDs required' 
    }, { status: 400 });

  } catch (error) {
    console.error('Error deleting notification:', error);
    return json({ 
      success: false, 
      error: 'Failed to delete notification' 
    }, { status: 500 });
  }
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: authResult.status || 401 });
    }

    const user = authResult.user;
    const { title, message, type = 'info', student_id, section_id, send_to_all = false } = await request.json();

    // Validate required fields
    if (!title || !message) {
      return json({ 
        error: 'Title and message are required' 
      }, { status: 400 });
    }

    // Connect to MongoDB
    const db = await connectToDatabase();
    const notificationsCollection = db.collection('notifications');
    const studentsCollection = db.collection('students');

    let targetStudents = [];

    if (send_to_all) {
      // Send to all students
      const students = await studentsCollection.find({}, { projection: { _id: 1 } }).toArray();
      targetStudents = students.map(student => student._id);
    } else if (section_id) {
      // Send to all students in a specific section
      const students = await studentsCollection.find(
        { section_id: section_id }, 
        { projection: { _id: 1 } }
      ).toArray();
      targetStudents = students.map(student => student._id);
    } else if (student_id) {
      // Send to specific student
      targetStudents = [student_id];
    } else {
      return json({ 
        error: 'Must specify student_id, section_id, or send_to_all' 
      }, { status: 400 });
    }

    if (targetStudents.length === 0) {
      return json({ 
        error: 'No target students found' 
      }, { status: 400 });
    }

    // Create notifications for all target students
    const notifications = targetStudents.map(studentId => ({
      student_id: studentId,
      title: title,
      message: message,
      type: type,
      is_read: false,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: user.id
    }));

    const result = await notificationsCollection.insertMany(notifications);

    // Log activity
    await logActivityWithUser(
      'notification_create',
      `Created notification "${title}" for ${targetStudents.length} students`,
      user,
      request.headers.get('x-forwarded-for') || 'unknown'
    );

    return json({
      success: true,
      data: {
        message: 'Notification created successfully',
        notification_count: result.insertedCount,
        target_students: targetStudents.length
      }
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    return json({ 
      success: false, 
      error: 'Failed to create notification' 
    }, { status: 500 });
  }
}