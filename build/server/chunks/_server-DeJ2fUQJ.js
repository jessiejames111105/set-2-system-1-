import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

async function POST({ request }) {
  try {
    const userHeader = request.headers.get("x-user-info");
    if (!userHeader) {
      return json({ success: false, error: "Missing user header" }, { status: 400 });
    }
    let user;
    try {
      user = JSON.parse(userHeader);
    } catch (err) {
      return json({ success: false, error: "Invalid user header" }, { status: 400 });
    }
    if (!user || !user.id) {
      return json({ success: false, error: "Invalid user" }, { status: 400 });
    }
    const payload = await request.json().catch(() => ({}));
    const ts = payload && payload.timestamp ? new Date(payload.timestamp) : /* @__PURE__ */ new Date();
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");
    try {
      await usersCollection.updateOne(
        { _id: new ObjectId(user.id) },
        { $set: { last_active_at: ts } }
      );
    } catch (err) {
      console.error("Failed to update last_active_at:", err);
      return json({ success: false, error: "DB update failed" }, { status: 500 });
    }
    return json({ success: true, updated_at: ts.toISOString() });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export { POST };
//# sourceMappingURL=_server-DeJ2fUQJ.js.map
