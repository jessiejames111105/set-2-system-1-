import { c as client } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';

function getUserFromRequest(request) {
  const userHeader = request.headers.get("x-user-info");
  if (!userHeader) {
    return null;
  }
  try {
    return JSON.parse(userHeader);
  } catch (error) {
    console.error("Error parsing user header:", error);
    return null;
  }
}
async function logActivityWithUser(activityType, description, user, activityData = {}, ipAddress = null) {
  try {
    const db = client.db(process.env.MONGODB_DB_NAME);
    const activityLogsCollection = db.collection("activity_logs");
    let userId = null;
    if (user?.id) {
      try {
        userId = new ObjectId(user.id);
      } catch (e) {
        userId = user.id;
      }
    }
    const logEntry = {
      activity_type: activityType,
      user_id: userId,
      user_account_number: user?.account_number || null,
      activity_data: {
        description,
        full_name: user?.name || user?.full_name || "Unknown",
        account_type: user?.account_type || "Unknown",
        ...activityData
      },
      ip_address: ipAddress,
      created_at: /* @__PURE__ */ new Date()
    };
    await activityLogsCollection.insertOne(logEntry);
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}
async function verifyAuth(request, allowedRoles = []) {
  try {
    const user = getUserFromRequest(request);
    if (!user || !user.id) {
      return { success: false, error: "Authentication required" };
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    const userRecord = await usersCollection.findOne(
      { _id: new ObjectId(user.id) },
      { projection: { account_type: 1, status: 1 } }
    );
    if (!userRecord) {
      return { success: false, error: "User not found" };
    }
    if (userRecord.status === "archived") {
      return { success: false, error: "Account is archived" };
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRecord.account_type)) {
      return {
        success: false,
        error: `Access denied. Required roles: ${allowedRoles.join(", ")}`
      };
    }
    const updatedUser = {
      ...user,
      account_type: userRecord.account_type
    };
    return { success: true, user: updatedUser };
  } catch (error) {
    console.error("Error verifying authentication:", error);
    return { success: false, error: "Authentication verification failed" };
  }
}

export { getUserFromRequest as g, logActivityWithUser as l, verifyAuth as v };
//# sourceMappingURL=auth-helper-DY2o5dhz.js.map
