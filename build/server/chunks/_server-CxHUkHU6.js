import { j as json } from './index-CccDCyu_.js';
import { c as client } from './db-C-gxO138.js';
import { v as verifyAuth } from './auth-helper-DY2o5dhz.js';
import 'mongodb';
import 'dotenv';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
async function GET({ url, request }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const email = url.searchParams.get("email");
    if (!email) {
      return json({ error: "Email parameter is required" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return json({
        valid: false,
        exists: false,
        available: false,
        error: "Invalid email format"
      }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    const existingAccount = await usersCollection.findOne({
      email: email.toLowerCase(),
      // Case-insensitive email check
      $or: [
        { status: { $exists: false } },
        { status: "active" }
      ]
    });
    return json({
      valid: true,
      exists: !!existingAccount,
      available: !existingAccount
    });
  } catch (error) {
    console.error("Error checking email:", error);
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to check email" }, { status: 500 });
  }
}

export { GET };
//# sourceMappingURL=_server-CxHUkHU6.js.map
