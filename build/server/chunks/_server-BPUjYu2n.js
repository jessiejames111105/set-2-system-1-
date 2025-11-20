import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import { v as verifyAuth } from './auth-helper-DY2o5dhz.js';
import 'dotenv';

async function GET({ url, request }) {
  try {
    const action = url.searchParams.get("action");
    const userId = url.searchParams.get("id");
    if (userId) {
      const authResult = await verifyAuth(request, ["student", "teacher", "adviser", "admin"]);
      if (!authResult.success) {
        return json({ error: authResult.error }, { status: 401 });
      }
      const currentUser = authResult.user;
      if (currentUser.account_type !== "admin" && currentUser.id !== userId) {
        return json({
          error: "Unauthorized: You can only view your own data"
        }, { status: 403 });
      }
      const db = await connectToDatabase();
      const user = await db.collection("users").findOne({
        _id: new ObjectId(userId)
      });
      if (!user) {
        return json({ error: "User not found" }, { status: 404 });
      }
      const userData = {
        id: user._id.toString(),
        account_number: user.account_number,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        middle_initial: user.middle_initial,
        email: user.email,
        contact_number: user.contact_number,
        address: user.address,
        birth_date: user.birth_date,
        age: user.age,
        guardian: user.guardian,
        gender: user.gender,
        grade_level: user.grade_level,
        account_type: user.account_type,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at
      };
      return json({ success: true, user: userData });
    }
    switch (action) {
      case "teachers": {
        const db = await connectToDatabase();
        const teachers = await db.collection("users").aggregate([
          {
            $match: {
              account_type: "teacher",
              $or: [
                { status: { $exists: false } },
                { status: "active" }
              ]
            }
          },
          {
            $lookup: {
              from: "teacher_departments",
              localField: "_id",
              foreignField: "teacher_id",
              as: "teacher_departments"
            }
          },
          {
            $sort: { first_name: 1, last_name: 1 }
          }
        ]).toArray();
        const formattedTeachers = teachers.map((teacher) => ({
          id: teacher._id,
          accountNumber: teacher.account_number,
          fullName: teacher.full_name,
          first_name: teacher.first_name,
          last_name: teacher.last_name,
          middleInitial: teacher.middle_initial,
          email: teacher.email,
          accountType: teacher.account_type,
          createdAt: teacher.created_at,
          updatedAt: teacher.updated_at,
          // Include all department_ids as an array if the teacher has departments assigned
          department_ids: teacher.teacher_departments && teacher.teacher_departments.length > 0 ? teacher.teacher_departments.map((td) => td.department_id?.toString()) : []
        }));
        return json({ success: true, data: formattedTeachers });
      }
      default:
        return json({ error: "Invalid action parameter or missing id" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in /api/users:", error);
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to fetch user data" }, { status: 500 });
  }
}

export { GET };
//# sourceMappingURL=_server-BPUjYu2n.js.map
