import { j as json } from './index-CccDCyu_.js';
import { c as client } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import { v as verifyAuth, g as getUserFromRequest } from './auth-helper-DY2o5dhz.js';
import 'dotenv';

function getRandomColor() {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
    "#F8C471",
    "#82E0AA",
    "#F1948A",
    "#85C1E9",
    "#D7BDE2"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
async function GET({ url, request }) {
  try {
    const authResult = await verifyAuth(request, ["admin", "teacher", "adviser"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const searchTerm = url.searchParams.get("search") || "";
    const db = client.db(process.env.MONGODB_DB_NAME);
    const activityTypesCollection = db.collection("activity_types");
    let filter = {};
    if (searchTerm) {
      filter = {
        $or: [
          { name: { $regex: searchTerm, $options: "i" } },
          { code: { $regex: searchTerm, $options: "i" } }
        ]
      };
    }
    const activityTypes = await activityTypesCollection.find(filter).toArray();
    const formattedActivityTypes = activityTypes.map((activity) => ({
      id: activity._id.toString(),
      name: activity.name,
      code: activity.code,
      color: activity.color,
      icon: activity.icon,
      createdAt: activity.created_at,
      createdDate: new Date(activity.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(activity.updated_at || activity.created_at).toLocaleDateString("en-US")
    }));
    return json({
      success: true,
      data: formattedActivityTypes
    });
  } catch (error) {
    console.error("Error fetching activity types:", error);
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({
        success: false,
        message: "Database connection failed"
      }, { status: 503 });
    }
    return json({
      success: false,
      message: "Failed to fetch activity types: " + error.message
    }, { status: 500 });
  }
}
async function POST({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const data = await request.json();
    const { name, code, icon } = data;
    if (!name || !code) {
      return json({
        success: false,
        message: "Name and code are required"
      }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const activityTypesCollection = db.collection("activity_types");
    const existingActivity = await activityTypesCollection.findOne({ code: code.trim().toUpperCase() });
    if (existingActivity) {
      return json({
        success: false,
        message: "Activity type code already exists"
      }, { status: 409 });
    }
    const randomColor = getRandomColor();
    const newActivityData = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      color: randomColor,
      icon: icon || "event",
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date()
    };
    const result = await activityTypesCollection.insertOne(newActivityData);
    if (!result.insertedId) {
      return json({
        success: false,
        message: "Failed to create activity type"
      }, { status: 500 });
    }
    const newActivity = await activityTypesCollection.findOne({ _id: result.insertedId });
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "activity_type_created",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          name: newActivity.name,
          code: newActivity.code,
          color: newActivity.color,
          icon: newActivity.icon
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging activity type creation activity:", logError);
    }
    const formattedActivity = {
      id: newActivity._id.toString(),
      name: newActivity.name,
      code: newActivity.code,
      color: newActivity.color,
      icon: newActivity.icon,
      createdAt: newActivity.created_at,
      createdDate: new Date(newActivity.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(newActivity.updated_at).toLocaleDateString("en-US")
    };
    return json({
      success: true,
      message: "Activity type created successfully",
      data: formattedActivity
    });
  } catch (error) {
    console.error("Error creating activity type:", error);
    if (error.code === 11e3) {
      return json({
        success: false,
        message: "Activity type code already exists"
      }, { status: 409 });
    }
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({
        success: false,
        message: "Database connection failed"
      }, { status: 503 });
    }
    return json({
      success: false,
      message: "Failed to create activity type: " + error.message
    }, { status: 500 });
  }
}
async function PUT({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const data = await request.json();
    const { id, name, code, icon } = data;
    if (!id || !name || !code) {
      return json({
        success: false,
        message: "ID, name, and code are required"
      }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const activityTypesCollection = db.collection("activity_types");
    const existingActivity = await activityTypesCollection.findOne({ _id: new ObjectId(id) });
    if (!existingActivity) {
      return json({
        success: false,
        message: "Activity type not found"
      }, { status: 404 });
    }
    if (existingActivity.code !== code) {
      const codeExists = await activityTypesCollection.findOne({
        code,
        _id: { $ne: new ObjectId(id) }
      });
      if (codeExists) {
        return json({
          success: false,
          message: "Activity type code already exists"
        }, { status: 409 });
      }
    }
    const updateData = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      icon: icon || existingActivity.icon,
      updated_at: /* @__PURE__ */ new Date()
    };
    const result = await activityTypesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    if (result.matchedCount === 0) {
      return json({
        success: false,
        message: "Activity type not found"
      }, { status: 404 });
    }
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "activity_type_updated",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          id,
          name: updateData.name,
          code: updateData.code,
          icon: updateData.icon,
          previous_name: existingActivity.name,
          previous_code: existingActivity.code,
          previous_icon: existingActivity.icon
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging activity type update activity:", logError);
    }
    const updatedActivity = await activityTypesCollection.findOne({ _id: new ObjectId(id) });
    const formattedActivity = {
      id: updatedActivity._id.toString(),
      name: updatedActivity.name,
      code: updatedActivity.code,
      color: updatedActivity.color,
      icon: updatedActivity.icon,
      createdAt: updatedActivity.created_at,
      createdDate: new Date(updatedActivity.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(updatedActivity.updated_at).toLocaleDateString("en-US")
    };
    return json({
      success: true,
      message: `Activity type "${name}" updated successfully`,
      data: formattedActivity
    });
  } catch (error) {
    console.error("Error updating activity type:", error);
    if (error.code === 11e3) {
      return json({
        success: false,
        message: "Activity type code already exists"
      }, { status: 409 });
    }
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({
        success: false,
        message: "Database connection failed"
      }, { status: 503 });
    }
    return json({
      success: false,
      message: "Failed to update activity type: " + error.message
    }, { status: 500 });
  }
}
async function DELETE({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const data = await request.json();
    const { id } = data;
    if (!id) {
      return json({
        success: false,
        message: "Activity type ID is required"
      }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const activityTypesCollection = db.collection("activity_types");
    const existingActivity = await activityTypesCollection.findOne({ _id: new ObjectId(id) });
    if (!existingActivity) {
      return json({
        success: false,
        message: "Activity type not found"
      }, { status: 404 });
    }
    const result = await activityTypesCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return json({
        success: false,
        message: "Activity type not found"
      }, { status: 404 });
    }
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "activity_type_deleted",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          id,
          name: existingActivity.name,
          code: existingActivity.code,
          color: existingActivity.color,
          icon: existingActivity.icon
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging activity type deletion activity:", logError);
    }
    return json({
      success: true,
      message: `Activity type "${existingActivity.name}" deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting activity type:", error);
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({
        success: false,
        message: "Database connection failed"
      }, { status: 503 });
    }
    return json({
      success: false,
      message: "Failed to delete activity type: " + error.message
    }, { status: 500 });
  }
}

export { DELETE, GET, POST, PUT };
//# sourceMappingURL=_server-yrm5-4i9.js.map
