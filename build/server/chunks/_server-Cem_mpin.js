import bcrypt from 'bcrypt';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { g as getUserFromRequest, l as logActivityWithUser } from './auth-helper-DY2o5dhz.js';
import 'mongodb';
import 'dotenv';

async function POST(event) {
  const user = getUserFromRequest(event.request);
  console.log("Password change request - User data:", user);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const { currentPassword, newPassword } = await event.request.json();
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({
        error: "Current password and new password are required"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (newPassword.length < 8) {
      return new Response(JSON.stringify({
        error: "New password must be at least 8 characters long"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");
    const userDoc = await usersCollection.findOne({ account_number: user.account_number });
    if (!userDoc) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userDoc.password_hash);
    if (!isCurrentPasswordValid) {
      return new Response(JSON.stringify({
        error: "Current password is incorrect"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    await usersCollection.updateOne(
      { account_number: user.account_number },
      {
        $set: {
          password_hash: newPasswordHash,
          updated_at: /* @__PURE__ */ new Date()
        }
      }
    );
    await logActivityWithUser(
      "password_changed",
      "User changed their password",
      user,
      event.getClientAddress()
    );
    return new Response(JSON.stringify({
      success: true,
      message: "Password changed successfully"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return new Response(JSON.stringify({
      error: "Internal server error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export { POST };
//# sourceMappingURL=_server-Cem_mpin.js.map
