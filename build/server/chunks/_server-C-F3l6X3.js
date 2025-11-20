import { j as json } from './index-CccDCyu_.js';
import { c as client } from './db-C-gxO138.js';
import crypto from 'crypto';
import 'mongodb';
import 'dotenv';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
async function POST({ request }) {
  try {
    const { email } = await request.json();
    if (!email) {
      return json({ error: "Email address is required" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return json({ error: "Invalid email format" }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({
      email: email.toLowerCase(),
      $or: [
        { status: { $exists: false } },
        { status: "active" }
      ]
    });
    if (!user) {
      return json({
        success: true,
        message: "If an account with this email exists, a password reset code has been sent."
      });
    }
    const resetCode = crypto.randomInt(1e5, 999999).toString();
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1e3);
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          password_reset_code: resetCode,
          password_reset_token: resetToken,
          password_reset_expires: expiresAt,
          password_reset_attempts: 0,
          updated_at: /* @__PURE__ */ new Date()
        }
      }
    );
    import('./email-helper-iXLHBIzq.js').then(({ sendPasswordResetEmail }) => {
      sendPasswordResetEmail({
        email: user.email,
        fullName: user.full_name,
        resetCode,
        accountNumber: user.account_number
      }).catch((error) => {
        console.error("Error sending password reset email:", error);
      });
    });
    return json({
      success: true,
      resetToken,
      message: "If an account with this email exists, a password reset code has been sent."
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to process password reset request" }, { status: 500 });
  }
}

export { POST };
//# sourceMappingURL=_server-C-F3l6X3.js.map
