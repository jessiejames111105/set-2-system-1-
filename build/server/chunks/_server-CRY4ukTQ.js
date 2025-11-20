import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { v as verifyAuth, g as getUserFromRequest } from './auth-helper-DY2o5dhz.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

async function GET({ url, request }) {
  try {
    const authResult = await verifyAuth(request, ["admin", "teacher", "adviser"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const searchTerm = url.searchParams.get("search") || "";
    const building = url.searchParams.get("building");
    const status = url.searchParams.get("status");
    const db = await connectToDatabase();
    const roomsCollection = db.collection("rooms");
    const sectionsCollection = db.collection("sections");
    let query = {};
    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { building: { $regex: searchTerm, $options: "i" } },
        { floor: { $regex: searchTerm, $options: "i" } }
      ];
    }
    if (building && building !== "") {
      query.building = { $regex: `^${building}$`, $options: "i" };
    }
    if (status && status !== "") {
      query.status = status;
    }
    const rooms = await roomsCollection.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "sections",
          localField: "_id",
          foreignField: "room_id",
          as: "assignedSections",
          pipeline: [
            { $match: { status: "active" } }
          ]
        }
      },
      { $sort: { created_at: -1 } }
    ]).toArray();
    const formattedRooms = rooms.map((room) => ({
      id: room._id.toString(),
      name: room.name,
      building: room.building,
      floor: room.floor,
      status: room.status,
      assignedTo: room.assigned_to,
      createdDate: new Date(room.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(room.updated_at).toLocaleDateString("en-US"),
      assignedSections: room.assignedSections.map((section) => ({
        id: section._id.toString(),
        name: section.name,
        gradeLevel: section.grade_level,
        schoolYear: section.school_year
      }))
    }));
    return json({
      success: true,
      data: formattedRooms
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return json({
      success: false,
      message: "Failed to fetch rooms: " + error.message
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
    const { name, building, floor } = data;
    if (!name || !building || !floor) {
      return json({
        success: false,
        message: "Name, building, and floor are required"
      }, { status: 400 });
    }
    const db = await connectToDatabase();
    const roomsCollection = db.collection("rooms");
    const existingRoom = await roomsCollection.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      building: { $regex: `^${building}$`, $options: "i" },
      floor: { $regex: `^${floor}$`, $options: "i" }
    });
    if (existingRoom) {
      return json({
        success: false,
        message: "A room with this name already exists in the same building and floor"
      }, { status: 409 });
    }
    const newRoom = {
      name,
      building,
      floor,
      status: "available",
      assigned_to: null,
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date()
    };
    const result = await roomsCollection.insertOne(newRoom);
    newRoom._id = result.insertedId;
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "room_created",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.account_number || null,
        activity_data: {
          room_name: newRoom.name,
          building: newRoom.building,
          floor: newRoom.floor
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging room creation activity:", logError);
    }
    const formattedRoom = {
      id: newRoom._id.toString(),
      name: newRoom.name,
      building: newRoom.building,
      floor: newRoom.floor,
      status: newRoom.status,
      assignedTo: newRoom.assigned_to,
      createdDate: new Date(newRoom.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(newRoom.updated_at).toLocaleDateString("en-US"),
      assignedSections: []
    };
    return json({
      success: true,
      message: `Room "${name}" created successfully`,
      data: formattedRoom
    });
  } catch (error) {
    console.error("Error creating room:", error);
    return json({
      success: false,
      message: "Failed to create room: " + error.message
    }, { status: 500 });
  }
}
async function PATCH({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const data = await request.json();
    const { roomId, sectionIds, action } = data;
    if (!roomId || !action) {
      return json({
        success: false,
        message: "Room ID and action are required"
      }, { status: 400 });
    }
    if (action === "assign" && (!sectionIds || !Array.isArray(sectionIds) || sectionIds.length === 0)) {
      return json({
        success: false,
        message: "Section IDs are required for assignment"
      }, { status: 400 });
    }
    const db = await connectToDatabase();
    const roomsCollection = db.collection("rooms");
    const sectionsCollection = db.collection("sections");
    const room = await roomsCollection.findOne({ _id: new ObjectId(roomId) });
    if (!room) {
      return json({
        success: false,
        message: "Room not found"
      }, { status: 404 });
    }
    if (action === "assign") {
      const sectionObjectIds = sectionIds.map((id) => new ObjectId(id));
      const sections = await sectionsCollection.find({
        _id: { $in: sectionObjectIds },
        status: "active"
      }).toArray();
      if (sections.length !== sectionIds.length) {
        return json({
          success: false,
          message: "One or more sections not found or inactive"
        }, { status: 404 });
      }
      const conflictingSections = sections.filter(
        (section) => section.room_id && section.room_id.toString() !== roomId
      );
      if (conflictingSections.length > 0) {
        return json({
          success: false,
          message: `Some sections are already assigned to other rooms: ${conflictingSections.map((s) => s.name).join(", ")}`
        }, { status: 409 });
      }
      await sectionsCollection.updateMany(
        { _id: { $in: sectionObjectIds } },
        {
          $set: {
            room_id: new ObjectId(roomId),
            updated_at: /* @__PURE__ */ new Date()
          }
        }
      );
      await roomsCollection.updateOne(
        { _id: new ObjectId(roomId) },
        {
          $set: {
            status: "assigned",
            updated_at: /* @__PURE__ */ new Date()
          }
        }
      );
      try {
        const user = await getUserFromRequest(request);
        const ip_address = getClientAddress();
        const user_agent = request.headers.get("user-agent");
        const activityCollection = db.collection("activity_logs");
        await activityCollection.insertOne({
          activity_type: "room_sections_assigned",
          user_id: user?.id ? new ObjectId(user.id) : null,
          user_account_number: user?.account_number || null,
          activity_data: {
            room_name: room.name,
            section_names: sections.map((s) => s.name)
          },
          ip_address,
          user_agent,
          created_at: /* @__PURE__ */ new Date()
        });
      } catch (logError) {
        console.error("Error logging room assignment activity:", logError);
      }
      return json({
        success: true,
        message: `Sections assigned to room "${room.name}" successfully`
      });
    } else if (action === "unassign") {
      const unassignResult = await sectionsCollection.find({ room_id: new ObjectId(roomId) }).toArray();
      await sectionsCollection.updateMany(
        { room_id: new ObjectId(roomId) },
        {
          $unset: { room_id: "" },
          $set: { updated_at: /* @__PURE__ */ new Date() }
        }
      );
      await roomsCollection.updateOne(
        { _id: new ObjectId(roomId) },
        {
          $set: {
            status: "available",
            updated_at: /* @__PURE__ */ new Date()
          }
        }
      );
      try {
        const user = await getUserFromRequest(request);
        const ip_address = getClientAddress();
        const user_agent = request.headers.get("user-agent");
        const activityCollection = db.collection("activity_logs");
        await activityCollection.insertOne({
          activity_type: "room_sections_unassigned",
          user_id: user?.id ? new ObjectId(user.id) : null,
          user_account_number: user?.account_number || null,
          activity_data: {
            room_name: room.name,
            unassigned_sections: unassignResult.map((s) => ({ name: s.name }))
          },
          ip_address,
          user_agent,
          created_at: /* @__PURE__ */ new Date()
        });
      } catch (logError) {
        console.error("Error logging room unassignment activity:", logError);
      }
      return json({
        success: true,
        message: `All sections unassigned from room "${room.name}" successfully`
      });
    } else {
      return json({
        success: false,
        message: 'Invalid action. Use "assign" or "unassign"'
      }, { status: 400 });
    }
  } catch (error) {
    console.error("Error managing room-section assignment:", error);
    return json({
      success: false,
      message: "Failed to manage room-section assignment: " + error.message
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
    const { id, name, building, floor, status, assignedTo } = data;
    if (!id || !name || !building || !floor) {
      return json({
        success: false,
        message: "ID, name, building, and floor are required"
      }, { status: 400 });
    }
    const db = await connectToDatabase();
    const roomsCollection = db.collection("rooms");
    const existingRoom = await roomsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingRoom) {
      return json({
        success: false,
        message: "Room not found"
      }, { status: 404 });
    }
    const nameConflict = await roomsCollection.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      building: { $regex: `^${building}$`, $options: "i" },
      floor: { $regex: `^${floor}$`, $options: "i" },
      _id: { $ne: new ObjectId(id) }
    });
    if (nameConflict) {
      return json({
        success: false,
        message: "A room with this name already exists in the same building and floor"
      }, { status: 409 });
    }
    const updateData = {
      name,
      building,
      floor,
      status: status || "available",
      assigned_to: assignedTo || null,
      updated_at: /* @__PURE__ */ new Date()
    };
    await roomsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    const updatedRoom = await roomsCollection.findOne({ _id: new ObjectId(id) });
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "room_updated",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.account_number || null,
        activity_data: {
          room_name: updatedRoom.name,
          building: updatedRoom.building,
          floor: updatedRoom.floor
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging room update activity:", logError);
    }
    const formattedRoom = {
      id: updatedRoom._id.toString(),
      name: updatedRoom.name,
      building: updatedRoom.building,
      floor: updatedRoom.floor,
      status: updatedRoom.status,
      assignedTo: updatedRoom.assigned_to,
      createdDate: new Date(updatedRoom.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(updatedRoom.updated_at).toLocaleDateString("en-US")
    };
    return json({
      success: true,
      message: `Room "${name}" updated successfully`,
      data: formattedRoom
    });
  } catch (error) {
    console.error("Error updating room:", error);
    return json({
      success: false,
      message: "Failed to update room: " + error.message
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
        message: "Room ID is required"
      }, { status: 400 });
    }
    const db = await connectToDatabase();
    const roomsCollection = db.collection("rooms");
    const existingRoom = await roomsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingRoom) {
      return json({
        success: false,
        message: "Room not found"
      }, { status: 404 });
    }
    await roomsCollection.deleteOne({ _id: new ObjectId(id) });
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "room_deleted",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.account_number || null,
        activity_data: {
          room_name: existingRoom.name,
          building: existingRoom.building,
          floor: existingRoom.floor
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging room deletion activity:", logError);
    }
    return json({
      success: true,
      message: `Room "${existingRoom.name}" has been removed successfully`
    });
  } catch (error) {
    console.error("Error deleting room:", error);
    return json({
      success: false,
      message: "Failed to delete room: " + error.message
    }, { status: 500 });
  }
}

export { DELETE, GET, PATCH, POST, PUT };
//# sourceMappingURL=_server-CRY4ukTQ.js.map
