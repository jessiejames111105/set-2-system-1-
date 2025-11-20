import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { v as verifyAuth } from './auth-helper-DY2o5dhz.js';
import 'mongodb';
import 'dotenv';

async function GET({ request, url }) {
  try {
    const authResult = await verifyAuth(request, ["admin", "teacher", "adviser"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const db = await connectToDatabase();
    const sectionsData = await db.collection("sections").aggregate([
      {
        $match: {
          status: "active"
        }
      },
      {
        $group: {
          _id: "$grade_level",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]).toArray();
    const transformedData = sectionsData.map((item) => ({
      grade_level: item._id.toString(),
      section_count: item.count
    }));
    return json({
      success: true,
      data: transformedData,
      metadata: {
        total_sections: sectionsData.reduce((sum, item) => sum + item.count, 0),
        grade_levels: sectionsData.length
      }
    });
  } catch (error) {
    console.error("Error fetching sections per grade:", error);
    return json({
      success: false,
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}

export { GET };
//# sourceMappingURL=_server-5d45jsMG.js.map
