import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { v as verifyAuth, l as logActivityWithUser } from './auth-helper-DY2o5dhz.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

async function GET({ url, request }) {
  try {
    const authResult = await verifyAuth(request, ["student"]);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: authResult.status || 401 });
    }
    const user = authResult.user;
    const studentId = url.searchParams.get("studentId") || user.id;
    const filter = url.searchParams.get("filter") || "all";
    if (user.account_type === "student" && studentId !== user.id) {
      return json({
        success: false,
        error: "Unauthorized: You can only view your own notifications"
      }, { status: 403 });
    }
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");
    const query = { student_id: studentId };
    if (filter === "unread") {
      query.is_read = false;
    } else if (filter === "grade") {
      query.type = "grade";
    } else if (filter === "document") {
      query.type = { $in: ["document", "document_request"] };
    }
    const notifications = await notificationsCollection.find(query).sort({ created_at: -1 }).toArray();
    const formattedNotifications = notifications.map((notification) => ({
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
    const unreadCount = notifications.filter((n) => !n.is_read).length;
    const totalCount = notifications.length;
    return json({
      success: true,
      data: formattedNotifications,
      unreadCount,
      totalCount
    });
  } catch (error) {
    console.error("Error fetching student notifications:", error);
    return json({
      success: false,
      error: "Failed to fetch notifications"
    }, { status: 500 });
  }
}
async function PATCH({ request }) {
  try {
    const authResult = await verifyAuth(request, ["student"]);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: authResult.status || 401 });
    }
    const user = authResult.user;
    const requestBody = await request.json();
    const { studentId, notificationId, isRead, markAllAsRead } = requestBody;
    if (user.account_type === "student" && studentId !== user.id) {
      return json({
        success: false,
        error: "Unauthorized: You can only update your own notifications"
      }, { status: 403 });
    }
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");
    if (markAllAsRead) {
      const result = await notificationsCollection.updateMany(
        { student_id: studentId, is_read: false },
        {
          $set: {
            is_read: true,
            updated_at: /* @__PURE__ */ new Date()
          }
        }
      );
      await logActivityWithUser(
        "notifications_mark_all_read",
        `Marked ${result.modifiedCount} notifications as read`,
        user
      );
      return json({
        success: true,
        data: {
          updatedCount: result.modifiedCount,
          message: "All notifications marked as read"
        }
      });
    }
    if (notificationId && isRead !== void 0) {
      const existingNotification = await notificationsCollection.findOne({
        _id: new ObjectId(notificationId),
        student_id: studentId
      });
      if (!existingNotification) {
        return json({
          success: false,
          error: "Notification not found or access denied"
        }, { status: 404 });
      }
      const result = await notificationsCollection.findOneAndUpdate(
        { _id: new ObjectId(notificationId), student_id: studentId },
        {
          $set: {
            is_read: isRead,
            updated_at: /* @__PURE__ */ new Date()
          }
        },
        { returnDocument: "after" }
      );
      const updatedNotification = result.value || { ...existingNotification, is_read: isRead, updated_at: /* @__PURE__ */ new Date() };
      await logActivityWithUser(
        "notification_updated",
        `Marked notification as ${isRead ? "read" : "unread"}: ${updatedNotification.title}`,
        user
      );
      return json({
        success: true,
        data: {
          id: updatedNotification._id.toString(),
          isRead: updatedNotification.is_read,
          message: `Notification marked as ${isRead ? "read" : "unread"}`
        }
      });
    }
    return json({
      success: false,
      error: "Invalid parameters"
    }, { status: 400 });
  } catch (error) {
    console.error("Error updating student notification:", error);
    return json({
      success: false,
      error: "Failed to update notification"
    }, { status: 500 });
  }
}
async function DELETE({ request }) {
  try {
    const authResult = await verifyAuth(request, ["student"]);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: authResult.status || 401 });
    }
    const user = authResult.user;
    const requestBody = await request.json();
    const { studentId, notificationId, clearAllRead } = requestBody;
    if (user.account_type === "student" && studentId !== user.id) {
      return json({
        success: false,
        error: "Unauthorized: You can only delete your own notifications"
      }, { status: 403 });
    }
    const db = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");
    if (clearAllRead) {
      const result = await notificationsCollection.deleteMany({
        student_id: studentId,
        is_read: true
      });
      await logActivityWithUser(
        "notifications_clear_read",
        `Deleted ${result.deletedCount} read notifications`,
        user
      );
      return json({
        success: true,
        data: {
          deletedCount: result.deletedCount,
          message: "All read notifications cleared successfully"
        }
      });
    }
    if (notificationId) {
      const existingNotification = await notificationsCollection.findOne({
        _id: new ObjectId(notificationId),
        student_id: studentId
      });
      if (!existingNotification) {
        return json({
          success: false,
          error: "Notification not found or access denied"
        }, { status: 404 });
      }
      const result = await notificationsCollection.findOneAndDelete({
        _id: new ObjectId(notificationId),
        student_id: studentId
      });
      await logActivityWithUser(
        "notification_deleted",
        `Deleted notification: ${existingNotification.title}`,
        user
      );
      return json({
        success: true,
        data: {
          message: "Notification deleted successfully"
        }
      });
    }
    return json({
      success: false,
      error: "Invalid parameters"
    }, { status: 400 });
  } catch (error) {
    console.error("Error deleting student notification:", error);
    return json({
      success: false,
      error: "Failed to delete notification"
    }, { status: 500 });
  }
}

export { DELETE, GET, PATCH };
//# sourceMappingURL=_server-sbxLEn3W.js.map
