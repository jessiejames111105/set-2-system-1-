import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { getUserFromRequest, logActivityWithUser, verifyAuth } from '../helper/auth-helper.js';
import { ObjectId } from 'mongodb';

// GET /api/rooms - Fetch all rooms with optional filtering and assigned sections
export async function GET({ url, request }) {
  try {
    // Verify authentication - admins, teachers, and advisers can view rooms
    const authResult = await verifyAuth(request, ['admin', 'teacher', 'adviser']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const searchTerm = url.searchParams.get('search') || '';
    const building = url.searchParams.get('building');
    const status = url.searchParams.get('status');
    
    const db = await connectToDatabase();
    const roomsCollection = db.collection('rooms');
    const sectionsCollection = db.collection('sections');
    
    // Build MongoDB query
    let query = {};
    
    // Add search filter
    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { building: { $regex: searchTerm, $options: 'i' } },
        { floor: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // Add building filter
    if (building && building !== '') {
      query.building = { $regex: `^${building}$`, $options: 'i' };
    }
    
    // Add status filter
    if (status && status !== '') {
      query.status = status;
    }
    
    // Fetch rooms with aggregation to include assigned sections
    const rooms = await roomsCollection.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'sections',
          localField: '_id',
          foreignField: 'room_id',
          as: 'assignedSections',
          pipeline: [
            { $match: { status: 'active' } }
          ]
        }
      },
      { $sort: { created_at: -1 } }
    ]).toArray();
    
    // Format response to match frontend expectations
    const formattedRooms = rooms.map(room => ({
      id: room._id.toString(),
      name: room.name,
      building: room.building,
      floor: room.floor,
      status: room.status,
      assignedTo: room.assigned_to,
      createdDate: new Date(room.created_at).toLocaleDateString('en-US'),
      updatedDate: new Date(room.updated_at).toLocaleDateString('en-US'),
      assignedSections: room.assignedSections.map(section => ({
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
    console.error('Error fetching rooms:', error);
    return json({
      success: false,
      message: 'Failed to fetch rooms: ' + error.message
    }, { status: 500 });
  }
}

// POST /api/rooms - Create a new room
export async function POST({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can create rooms
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const data = await request.json();
    const { name, building, floor } = data;
    
    // Validation
    if (!name || !building || !floor) {
      return json({
        success: false,
        message: 'Name, building, and floor are required'
      }, { status: 400 });
    }
    
    const db = await connectToDatabase();
    const roomsCollection = db.collection('rooms');
    
    // Check if room with same name in same building and floor already exists
    const existingRoom = await roomsCollection.findOne({
      name: { $regex: `^${name}$`, $options: 'i' },
      building: { $regex: `^${building}$`, $options: 'i' },
      floor: { $regex: `^${floor}$`, $options: 'i' }
    });
    
    if (existingRoom) {
      return json({
        success: false,
        message: 'A room with this name already exists in the same building and floor'
      }, { status: 409 });
    }
    
    // Insert new room
    const newRoom = {
      name,
      building,
      floor,
      status: 'available',
      assigned_to: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await roomsCollection.insertOne(newRoom);
    newRoom._id = result.insertedId;
    
    // Log the room creation activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // Create activity log with proper structure
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'room_created',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.account_number || null,
        activity_data: {
          room_name: newRoom.name,
          building: newRoom.building,
          floor: newRoom.floor
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging room creation activity:', logError);
      // Don't fail the room creation if logging fails
    }
    
    // Format response to match component structure
    const formattedRoom = {
      id: newRoom._id.toString(),
      name: newRoom.name,
      building: newRoom.building,
      floor: newRoom.floor,
      status: newRoom.status,
      assignedTo: newRoom.assigned_to,
      createdDate: new Date(newRoom.created_at).toLocaleDateString('en-US'),
      updatedDate: new Date(newRoom.updated_at).toLocaleDateString('en-US'),
      assignedSections: []
    };
    
    return json({
      success: true,
      message: `Room "${name}" created successfully`,
      data: formattedRoom
    });
    
  } catch (error) {
    console.error('Error creating room:', error);
    return json({
      success: false,
      message: 'Failed to create room: ' + error.message
    }, { status: 500 });
  }
}

// PATCH /api/rooms - Assign or unassign sections to/from rooms
export async function PATCH({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can assign/unassign sections to rooms
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const data = await request.json();
    const { roomId, sectionIds, action } = data;
    
    // Validation
    if (!roomId || !action) {
      return json({
        success: false,
        message: 'Room ID and action are required'
      }, { status: 400 });
    }
    
    if (action === 'assign' && (!sectionIds || !Array.isArray(sectionIds) || sectionIds.length === 0)) {
      return json({
        success: false,
        message: 'Section IDs are required for assignment'
      }, { status: 400 });
    }
    
    const db = await connectToDatabase();
    const roomsCollection = db.collection('rooms');
    const sectionsCollection = db.collection('sections');
    
    // Check if room exists
    const room = await roomsCollection.findOne({ _id: new ObjectId(roomId) });
    if (!room) {
      return json({
        success: false,
        message: 'Room not found'
      }, { status: 404 });
    }
    
    if (action === 'assign') {
      // Convert section IDs to ObjectIds
      const sectionObjectIds = sectionIds.map(id => new ObjectId(id));
      
      // Check if sections exist and are not already assigned to other rooms
      const sections = await sectionsCollection.find({
        _id: { $in: sectionObjectIds },
        status: 'active'
      }).toArray();
      
      if (sections.length !== sectionIds.length) {
        return json({
          success: false,
          message: 'One or more sections not found or inactive'
        }, { status: 404 });
      }
      
      // Check for conflicts with other rooms
      const conflictingSections = sections.filter(section => 
        section.room_id && section.room_id.toString() !== roomId
      );
      
      if (conflictingSections.length > 0) {
        return json({
          success: false,
          message: `Some sections are already assigned to other rooms: ${conflictingSections.map(s => s.name).join(', ')}`
        }, { status: 409 });
      }
      
      // Assign sections to room
      await sectionsCollection.updateMany(
        { _id: { $in: sectionObjectIds } },
        { 
          $set: { 
            room_id: new ObjectId(roomId),
            updated_at: new Date()
          }
        }
      );
      
      // Update room status to assigned
      await roomsCollection.updateOne(
        { _id: new ObjectId(roomId) },
        { 
          $set: { 
            status: 'assigned',
            updated_at: new Date()
          }
        }
      );
      
      // Log the assignment activity
      try {
        const user = await getUserFromRequest(request);
        const ip_address = getClientAddress();
        const user_agent = request.headers.get('user-agent');
        
        // Create activity log with proper structure
        const activityCollection = db.collection('activity_logs');
        await activityCollection.insertOne({
          activity_type: 'room_sections_assigned',
          user_id: user?.id ? new ObjectId(user.id) : null,
          user_account_number: user?.account_number || null,
          activity_data: {
            room_name: room.name,
            section_names: sections.map(s => s.name)
          },
          ip_address: ip_address,
          user_agent: user_agent,
          created_at: new Date()
        });
      } catch (logError) {
        console.error('Error logging room assignment activity:', logError);
      }
      
      return json({
        success: true,
        message: `Sections assigned to room "${room.name}" successfully`
      });
      
    } else if (action === 'unassign') {
      // Unassign all sections from the room
      const unassignResult = await sectionsCollection.find({ room_id: new ObjectId(roomId) }).toArray();
      
      await sectionsCollection.updateMany(
        { room_id: new ObjectId(roomId) },
        { 
          $unset: { room_id: "" },
          $set: { updated_at: new Date() }
        }
      );
      
      // Update room status to available
      await roomsCollection.updateOne(
        { _id: new ObjectId(roomId) },
        { 
          $set: { 
            status: 'available',
            updated_at: new Date()
          }
        }
      );
      
      // Log the unassignment activity
      try {
        const user = await getUserFromRequest(request);
        const ip_address = getClientAddress();
        const user_agent = request.headers.get('user-agent');
        
        // Create activity log with proper structure
        const activityCollection = db.collection('activity_logs');
        await activityCollection.insertOne({
          activity_type: 'room_sections_unassigned',
          user_id: user?.id ? new ObjectId(user.id) : null,
          user_account_number: user?.account_number || null,
          activity_data: {
            room_name: room.name,
            unassigned_sections: unassignResult.map(s => ({ name: s.name }))
          },
          ip_address: ip_address,
          user_agent: user_agent,
          created_at: new Date()
        });
      } catch (logError) {
        console.error('Error logging room unassignment activity:', logError);
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
    console.error('Error managing room-section assignment:', error);
    return json({
      success: false,
      message: 'Failed to manage room-section assignment: ' + error.message
    }, { status: 500 });
  }
}

// PUT /api/rooms - Update an existing room
export async function PUT({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can update rooms
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const data = await request.json();
    const { id, name, building, floor, status, assignedTo } = data;
    
    // Validation
    if (!id || !name || !building || !floor) {
      return json({
        success: false,
        message: 'ID, name, building, and floor are required'
      }, { status: 400 });
    }
    
    const db = await connectToDatabase();
    const roomsCollection = db.collection('rooms');
    
    // Check if room exists
    const existingRoom = await roomsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!existingRoom) {
      return json({
        success: false,
        message: 'Room not found'
      }, { status: 404 });
    }
    
    // Check if new name/building/floor conflicts with another room
    const nameConflict = await roomsCollection.findOne({
      name: { $regex: `^${name}$`, $options: 'i' },
      building: { $regex: `^${building}$`, $options: 'i' },
      floor: { $regex: `^${floor}$`, $options: 'i' },
      _id: { $ne: new ObjectId(id) }
    });
    
    if (nameConflict) {
      return json({
        success: false,
        message: 'A room with this name already exists in the same building and floor'
      }, { status: 409 });
    }
    
    // Update room
    const updateData = {
      name,
      building,
      floor,
      status: status || 'available',
      assigned_to: assignedTo || null,
      updated_at: new Date()
    };
    
    await roomsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    const updatedRoom = await roomsCollection.findOne({ _id: new ObjectId(id) });
    
    // Log the room update activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // Create activity log with proper structure
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'room_updated',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.account_number || null,
        activity_data: {
          room_name: updatedRoom.name,
          building: updatedRoom.building,
          floor: updatedRoom.floor
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging room update activity:', logError);
      // Don't fail the update if logging fails
    }
    
    // Format response to match component structure
    const formattedRoom = {
      id: updatedRoom._id.toString(),
      name: updatedRoom.name,
      building: updatedRoom.building,
      floor: updatedRoom.floor,
      status: updatedRoom.status,
      assignedTo: updatedRoom.assigned_to,
      createdDate: new Date(updatedRoom.created_at).toLocaleDateString('en-US'),
      updatedDate: new Date(updatedRoom.updated_at).toLocaleDateString('en-US')
    };
    
    return json({
      success: true,
      message: `Room "${name}" updated successfully`,
      data: formattedRoom
    });
    
  } catch (error) {
    console.error('Error updating room:', error);
    return json({
      success: false,
      message: 'Failed to update room: ' + error.message
    }, { status: 500 });
  }
}

// DELETE /api/rooms - Delete a room
export async function DELETE({ request, getClientAddress }) {
  try {
    // Verify authentication - only admins can delete rooms
    const authResult = await verifyAuth(request, ['admin']);
    if (!authResult.success) {
      return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
    }
    
    const data = await request.json();
    const { id } = data;
    
    if (!id) {
      return json({
        success: false,
        message: 'Room ID is required'
      }, { status: 400 });
    }
    
    const db = await connectToDatabase();
    const roomsCollection = db.collection('rooms');
    
    // Check if room exists and get its details
    const existingRoom = await roomsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!existingRoom) {
      return json({
        success: false,
        message: 'Room not found'
      }, { status: 404 });
    }
    
    // Delete the room
    await roomsCollection.deleteOne({ _id: new ObjectId(id) });
    
    // Log the room deletion activity
    try {
      // Get user info from request headers
      const user = await getUserFromRequest(request);
      
      // Get client IP and user agent
      const ip_address = getClientAddress();
      const user_agent = request.headers.get('user-agent');
      
      // Create activity log with proper structure
      const activityCollection = db.collection('activity_logs');
      await activityCollection.insertOne({
        activity_type: 'room_deleted',
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.account_number || null,
        activity_data: {
          room_name: existingRoom.name,
          building: existingRoom.building,
          floor: existingRoom.floor
        },
        ip_address: ip_address,
        user_agent: user_agent,
        created_at: new Date()
      });
    } catch (logError) {
      console.error('Error logging room deletion activity:', logError);
      // Don't fail the deletion if logging fails
    }
    
    return json({
      success: true,
      message: `Room "${existingRoom.name}" has been removed successfully`
    });
    
  } catch (error) {
    console.error('Error deleting room:', error);
    return json({
      success: false,
      message: 'Failed to delete room: ' + error.message
    }, { status: 500 });
  }
}