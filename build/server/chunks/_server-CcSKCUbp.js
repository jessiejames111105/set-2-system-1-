import { j as json } from './index-CccDCyu_.js';
import { c as client } from './db-C-gxO138.js';
import 'mongodb';
import 'dotenv';

async function POST({ request }) {
  try {
    const { resetToken, code } = await request.json();
    if (!resetToken || !code) {
      return json({ error: "Reset token and code are required" }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({
      password_reset_token: resetToken,
      $or: [
        { status: { $exists: false } },
        { status: "active" }
      ]
    });
    if (!user) {
      return json({ error: "Invalid or expired reset token" }, { status: 400 });
    }
    if (!user.password_reset_expires || /* @__PURE__ */ new Date() > new Date(user.password_reset_expires)) {
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $unset: {
            password_reset_code: "",
            password_reset_token: "",
            password_reset_expires: "",
            password_reset_attempts: ""
          }
        }
      );
      return json({ error: "Reset code has expired. Please request a new one." }, { status: 400 });
    }
    const attempts = user.password_reset_attempts || 0;
    if (attempts >= 5) {
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $unset: {
            password_reset_code: "",
            password_reset_token: "",
            password_reset_expires: "",
            password_reset_attempts: ""
          }
        }
      );
      return json({ error: "Too many failed attempts. Please request a new reset code." }, { status: 400 });
    }
    if (user.password_reset_code !== code) {
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            password_reset_attempts: attempts + 1
          }
        }
      );
      return json({
        error: "Invalid verification code",
        attemptsRemaining: 5 - (attempts + 1)
      }, { status: 400 });
    }
    return json({
      success: true,
      message: "Code verified successfully"
    });
  } catch (error) {
    console.error("Error verifying reset code:", error);
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to verify code" }, { status: 500 });
  }
}

export { POST };
//# sourceMappingURL=_server-CcSKCUbp.js.map
