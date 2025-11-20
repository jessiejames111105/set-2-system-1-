import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { v as verifyAuth } from './auth-helper-DY2o5dhz.js';
import 'mongodb';
import 'dotenv';

async function GET({ request }) {
  try {
    const authResult = await verifyAuth(request, ["admin", "teacher", "adviser"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const db = await connectToDatabase();
    const studentsCount = await db.collection("users").countDocuments({
      account_type: "student",
      $or: [
        { status: { $exists: false } },
        { status: "active" }
      ]
    });
    const teachersCount = await db.collection("users").countDocuments({
      account_type: "teacher",
      $or: [
        { status: { $exists: false } },
        { status: "active" }
      ]
    });
    const sectionsCount = await db.collection("sections").countDocuments({
      status: "active"
    });
    const roomsCount = await db.collection("rooms").countDocuments({});
    const statistics = {
      students: studentsCount,
      teachers: teachersCount,
      sections: sectionsCount,
      rooms: roomsCount
    };
    return json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error("Error fetching dashboard statistics:", error);
    return json({
      success: false,
      error: "Failed to fetch dashboard statistics"
    }, { status: 500 });
  }
}

export { GET };
//# sourceMappingURL=_server-D5zdczzX.js.map
