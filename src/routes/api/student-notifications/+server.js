import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { verifyAuth, logActivityWithUser } from '../helper/auth-helper.js';
import { ObjectId } from 'mongodb';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, request }) {
	try {
		// Verify authentication (students only)
		const authResult = await verifyAuth(request, ['student']);
		if (!authResult.success) {
			return json({ error: authResult.error }, { status: authResult.status || 401 });
		}

		const user = authResult.user;
		const studentId = url.searchParams.get('studentId') || user.id;
		const filter = url.searchParams.get('filter') || 'all';

		// Ensure students can only view their own notifications
		if (user.account_type === 'student' && studentId !== user.id) {
			return json({ 
				success: false,
				error: 'Unauthorized: You can only view your own notifications' 
			}, { status: 403 });
		}

		// Connect to MongoDB
		const db = await connectToDatabase();
		const notificationsCollection = db.collection('notifications');

		// Build MongoDB filter
		const query = { student_id: studentId };

		// Apply filter
		if (filter === 'unread') {
			query.is_read = false;
		} else if (filter === 'grade') {
			query.type = 'grade';
		} else if (filter === 'document') {
			query.type = { $in: ['document', 'document_request'] };
		}

		// Get notifications sorted by most recent first
		const notifications = await notificationsCollection
			.find(query)
			.sort({ created_at: -1 })
			.toArray();

		// Format notifications for frontend
		const formattedNotifications = notifications.map(notification => ({
			id: notification._id.toString(),
			type: notification.type,
			title: notification.title,
			message: notification.message,
			timestamp: notification.created_at,
			isRead: notification.is_read || false,
			adminNote: notification.admin_note || null,
			rejectionReason: notification.rejection_reason || null,
			metadata: {
				documentType: notification.document_type || null,
				status: notification.status || null,
				relatedId: notification.related_id || null,
				adminName: notification.admin_name || null,
				adminId: notification.admin_id || null
			}
		}));

		// Calculate counts
		const unreadCount = notifications.filter(n => !n.is_read).length;
		const totalCount = notifications.length;

		return json({
			success: true,
			data: formattedNotifications,
			unreadCount: unreadCount,
			totalCount: totalCount
		});

	} catch (error) {
		console.error('Error fetching student notifications:', error);
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
		const authResult = await verifyAuth(request, ['student']);
		if (!authResult.success) {
			return json({ error: authResult.error }, { status: authResult.status || 401 });
		}

		const user = authResult.user;
		const requestBody = await request.json();
		const { studentId, notificationId, isRead, markAllAsRead } = requestBody;

		// Ensure students can only update their own notifications
		if (user.account_type === 'student' && studentId !== user.id) {
			return json({ 
				success: false,
				error: 'Unauthorized: You can only update your own notifications' 
			}, { status: 403 });
		}

		// Connect to MongoDB
		const db = await connectToDatabase();
		const notificationsCollection = db.collection('notifications');

		// Mark all as read
		if (markAllAsRead) {
			const result = await notificationsCollection.updateMany(
				{ student_id: studentId, is_read: false },
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
				user
			);

			return json({
				success: true,
				data: {
					updatedCount: result.modifiedCount,
					message: 'All notifications marked as read'
				}
			});
		}

		// Update single notification status
		if (notificationId && isRead !== undefined) {
			// First check if notification exists and belongs to user
			const existingNotification = await notificationsCollection.findOne({
				_id: new ObjectId(notificationId),
				student_id: studentId
			});

			if (!existingNotification) {
				return json({ 
					success: false,
					error: 'Notification not found or access denied' 
				}, { status: 404 });
			}

			// Update the notification
			const result = await notificationsCollection.findOneAndUpdate(
				{ _id: new ObjectId(notificationId), student_id: studentId },
				{ 
					$set: { 
						is_read: isRead, 
						updated_at: new Date() 
					} 
				},
				{ returnDocument: 'after' }
			);

			const updatedNotification = result.value || { ...existingNotification, is_read: isRead, updated_at: new Date() };

			// Log activity
			await logActivityWithUser(
				'notification_updated',
				`Marked notification as ${isRead ? 'read' : 'unread'}: ${updatedNotification.title}`,
				user
			);

			return json({
				success: true,
				data: {
					id: updatedNotification._id.toString(),
					isRead: updatedNotification.is_read,
					message: `Notification marked as ${isRead ? 'read' : 'unread'}`
				}
			});
		}

		return json({ 
			success: false,
			error: 'Invalid parameters' 
		}, { status: 400 });

	} catch (error) {
		console.error('Error updating student notification:', error);
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
		const authResult = await verifyAuth(request, ['student']);
		if (!authResult.success) {
			return json({ error: authResult.error }, { status: authResult.status || 401 });
		}

		const user = authResult.user;
		const requestBody = await request.json();
		const { studentId, notificationId, clearAllRead } = requestBody;

		// Ensure students can only delete their own notifications
		if (user.account_type === 'student' && studentId !== user.id) {
			return json({ 
				success: false,
				error: 'Unauthorized: You can only delete your own notifications' 
			}, { status: 403 });
		}

		// Connect to MongoDB
		const db = await connectToDatabase();
		const notificationsCollection = db.collection('notifications');

		// Clear all read notifications
		if (clearAllRead) {
			const result = await notificationsCollection.deleteMany({
				student_id: studentId,
				is_read: true
			});

			// Log activity
			await logActivityWithUser(
				'notifications_clear_read',
				`Deleted ${result.deletedCount} read notifications`,
				user
			);

			return json({
				success: true,
				data: {
					deletedCount: result.deletedCount,
					message: 'All read notifications cleared successfully'
				}
			});
		}

		// Delete single notification
		if (notificationId) {
			// First check if notification exists and belongs to user
			const existingNotification = await notificationsCollection.findOne({
				_id: new ObjectId(notificationId),
				student_id: studentId
			});

			if (!existingNotification) {
				return json({ 
					success: false,
					error: 'Notification not found or access denied' 
				}, { status: 404 });
			}

			// Delete the notification
			const result = await notificationsCollection.findOneAndDelete({
				_id: new ObjectId(notificationId),
				student_id: studentId
			});

			// Log activity
			await logActivityWithUser(
				'notification_deleted',
				`Deleted notification: ${existingNotification.title}`,
				user
			);

			return json({
				success: true,
				data: {
					message: 'Notification deleted successfully'
				}
			});
		}

		return json({ 
			success: false,
			error: 'Invalid parameters' 
		}, { status: 400 });

	} catch (error) {
		console.error('Error deleting student notification:', error);
		return json({ 
			success: false, 
			error: 'Failed to delete notification' 
		}, { status: 500 });
	}
}

