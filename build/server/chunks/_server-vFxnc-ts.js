import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import bcrypt from 'bcrypt';
import 'mongodb';
import 'dotenv';

let globalLoginAttempts = { attempts: 0, lockedUntil: null };
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 10 * 60 * 1e3;
function checkLoginAttempts() {
  if (globalLoginAttempts.lockedUntil && /* @__PURE__ */ new Date() >= globalLoginAttempts.lockedUntil) {
    globalLoginAttempts = { attempts: 0, lockedUntil: null };
    return { isLocked: false, remainingTime: 0, attemptsLeft: MAX_LOGIN_ATTEMPTS };
  }
  if (globalLoginAttempts.lockedUntil) {
    const remainingTime = Math.ceil((globalLoginAttempts.lockedUntil - /* @__PURE__ */ new Date()) / 1e3);
    return { isLocked: true, remainingTime, attemptsLeft: 0 };
  }
  const attemptsLeft = MAX_LOGIN_ATTEMPTS - globalLoginAttempts.attempts;
  return { isLocked: false, remainingTime: 0, attemptsLeft };
}
function recordFailedAttempt() {
  globalLoginAttempts.attempts += 1;
  if (globalLoginAttempts.attempts >= MAX_LOGIN_ATTEMPTS) {
    globalLoginAttempts.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }
  return MAX_LOGIN_ATTEMPTS - globalLoginAttempts.attempts;
}
function clearLoginAttempts() {
  globalLoginAttempts = { attempts: 0, lockedUntil: null };
}
async function POST({ request, getClientAddress }) {
  try {
    const { accountNumber, password } = await request.json();
    if (!accountNumber || !password) {
      return json({ error: "Account number and password are required" }, { status: 400 });
    }
    if (typeof accountNumber !== "string" || typeof password !== "string") {
      return json({ error: "Invalid input format" }, { status: 400 });
    }
    const sanitizedAccountNumber = accountNumber.replace(/[^a-zA-Z0-9\-_]/g, "");
    if (sanitizedAccountNumber !== accountNumber || accountNumber.length > 50) {
      return json({ error: "Invalid account number format" }, { status: 400 });
    }
    if (password.length > 200) {
      return json({ error: "Password too long" }, { status: 400 });
    }
    const attemptStatus = checkLoginAttempts();
    if (attemptStatus.isLocked) {
      const minutes = Math.floor(attemptStatus.remainingTime / 60);
      const seconds = attemptStatus.remainingTime % 60;
      const timeString = minutes > 0 ? `${minutes} minute${minutes > 1 ? "s" : ""} and ${seconds} second${seconds > 1 ? "s" : ""}` : `${seconds} second${seconds > 1 ? "s" : ""}`;
      return json({
        error: `Login temporarily unavailable due to too many failed attempts. Please try again in ${timeString}.`,
        isLocked: true,
        remainingTime: attemptStatus.remainingTime
      }, { status: 429 });
    }
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");
    const user = await usersCollection.findOne({
      account_number: sanitizedAccountNumber,
      status: { $ne: "archived" }
      // Simpler condition: not archived = active/null/undefined
    });
    if (!user) {
      const attemptsLeft = recordFailedAttempt();
      if (attemptsLeft > 0) {
        return json({
          error: "Invalid account number or password",
          attemptsLeft
        }, { status: 401 });
      } else {
        return json({
          error: "Invalid account number or password. Login has been locked for 10 minutes due to too many failed attempts.",
          isLocked: true,
          attemptsLeft: 0
        }, { status: 429 });
      }
    }
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      const attemptsLeft = recordFailedAttempt();
      if (attemptsLeft > 0) {
        return json({
          error: "Invalid account number or password",
          attemptsLeft
        }, { status: 401 });
      } else {
        return json({
          error: "Invalid account number or password. Login has been locked for 10 minutes due to too many failed attempts.",
          isLocked: true,
          attemptsLeft: 0
        }, { status: 429 });
      }
    }
    clearLoginAttempts();
    const userData = {
      id: user._id,
      name: user.full_name,
      firstName: user.first_name,
      gender: user.gender,
      accountNumber: user.account_number,
      accountType: user.account_type
    };
    if (user.account_type === "admin") {
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityLogsCollection = db.collection("activity_logs");
      activityLogsCollection.insertOne({
        activity_type: "user_login",
        user_id: user._id,
        user_account_number: user.account_number,
        activity_data: {
          full_name: user.full_name,
          account_type: user.account_type
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      }).catch((logError) => {
        console.error("Error logging login activity:", logError);
      });
    }
    return json({
      success: true,
      user: userData,
      message: "Login successful"
    });
  } catch (error) {
    console.error("Authentication error:", error);
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Authentication failed. Please try again." }, { status: 500 });
  }
}

export { POST };
//# sourceMappingURL=_server-vFxnc-ts.js.map
