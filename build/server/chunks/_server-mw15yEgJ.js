import { j as json } from './index-CccDCyu_.js';
import { c as client } from './db-C-gxO138.js';
import bcrypt from 'bcrypt';
import { v as verifyAuth, g as getUserFromRequest } from './auth-helper-DY2o5dhz.js';
import { sendAccountCreationEmail } from './email-helper-iXLHBIzq.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
async function POST({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const { accountType, gender, gradeLevel, firstName, lastName, middleInitial, email, birthdate, address, guardian, contactNumber, createdBy } = await request.json();
    if (!accountType || !gender || !firstName || !lastName) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }
    if ((accountType === "student" || accountType === "teacher") && !email) {
      return json({ error: "Email is required for students and teachers" }, { status: 400 });
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return json({ error: "Invalid email format" }, { status: 400 });
    }
    if (email) {
      const db2 = client.db(process.env.MONGODB_DB_NAME);
      const usersCollection2 = db2.collection("users");
      const existingEmail = await usersCollection2.findOne({
        email: email.toLowerCase(),
        $or: [
          { status: { $exists: false } },
          { status: "active" }
        ]
      });
      if (existingEmail) {
        return json({ error: "This email is already registered" }, { status: 409 });
      }
    }
    if (accountType === "student" && !gradeLevel) {
      return json({ error: "Grade level is required for students" }, { status: 400 });
    }
    if (accountType === "student") {
      if (!birthdate || !address || !guardian || !contactNumber) {
        return json({ error: "Birthdate, address, guardian, and contact number are required for students" }, { status: 400 });
      }
    }
    let age = null;
    if (accountType === "student" && birthdate) {
      const birthDate = new Date(birthdate);
      const today = /* @__PURE__ */ new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || monthDiff === 0 && today.getDate() < birthDate.getDate()) {
        age--;
      }
    }
    const accountNumber = await generateAccountNumber(accountType);
    const hashedPassword = await bcrypt.hash(accountNumber, 10);
    const fullName = `${lastName}, ${firstName}${middleInitial ? " " + middleInitial + "." : ""}`;
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    const userDoc = {
      account_number: accountNumber,
      account_type: accountType,
      first_name: firstName,
      last_name: lastName,
      middle_initial: middleInitial || null,
      full_name: fullName,
      gender,
      email: email ? email.toLowerCase() : null,
      // Store email in lowercase
      grade_level: gradeLevel || null,
      birthdate: birthdate ? new Date(birthdate) : null,
      address: address || null,
      age,
      guardian: guardian || null,
      contact_number: contactNumber || null,
      password_hash: hashedPassword,
      status: "active",
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date()
    };
    const result = await usersCollection.insertOne(userDoc);
    const newAccount = {
      id: result.insertedId.toString(),
      account_number: accountNumber,
      full_name: fullName,
      account_type: accountType,
      created_at: userDoc.created_at,
      updated_at: userDoc.updated_at
    };
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "account_created",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          account_type: accountType,
          full_name: fullName,
          account_number: newAccount.account_number,
          grade_level: gradeLevel
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging account creation activity:", logError);
    }
    const response = {
      id: newAccount.id,
      name: newAccount.full_name,
      type: accountType === "student" ? "Student" : accountType === "teacher" ? "Teacher" : "Admin",
      number: newAccount.account_number,
      createdDate: new Date(newAccount.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(newAccount.updated_at).toLocaleDateString("en-US"),
      status: "active"
    };
    if (email) {
      sendAccountCreationEmail({
        email,
        fullName,
        accountNumber,
        accountType
      }).then((emailResult) => {
        if (emailResult.success) {
          console.log(`Account creation email sent to ${email}`);
        } else {
          console.error(`Failed to send account creation email to ${email}:`, emailResult.error);
        }
      }).catch((emailError) => {
        console.error(`Error sending account creation email to ${email}:`, emailError);
      });
    }
    return json({ success: true, account: response, emailSent: !!email }, { status: 201 });
  } catch (error) {
    console.error("Error creating account:", error);
    if (error.code === 11e3) {
      if (error.keyPattern && error.keyPattern.email) {
        return json({ error: "An account with this email already exists" }, { status: 409 });
      }
      if (error.keyPattern && error.keyPattern.account_number) {
        return json({ error: "Account number already exists" }, { status: 409 });
      }
    }
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }
}
async function GET({ url, request }) {
  try {
    const authResult = await verifyAuth(request, ["admin", "teacher", "adviser"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const user = authResult.user;
    const limit = url.searchParams.get("limit");
    const type = url.searchParams.get("type");
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    let filter = {
      $or: [
        { status: { $exists: false } },
        { status: "active" }
      ]
    };
    if (user.account_type === "teacher" || user.account_type === "adviser") {
      filter.account_type = "student";
    } else if (type) {
      filter.account_type = type;
    }
    let accounts;
    if (type === "teacher") {
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "teacher_departments",
            localField: "_id",
            foreignField: "teacher_id",
            as: "teacher_departments"
          }
        },
        {
          $lookup: {
            from: "departments",
            localField: "teacher_departments.department_id",
            foreignField: "_id",
            as: "departments"
          }
        },
        {
          $addFields: {
            // Get the first department name if available
            department_name: {
              $arrayElemAt: ["$departments.name", 0]
            }
          }
        },
        { $sort: { created_at: -1 } }
      ];
      if (limit && !isNaN(parseInt(limit))) {
        pipeline.push({ $limit: parseInt(limit) });
      }
      accounts = await usersCollection.aggregate(pipeline).toArray();
    } else {
      let query = usersCollection.find(filter).sort({ created_at: -1 });
      if (limit && !isNaN(parseInt(limit))) {
        query = query.limit(parseInt(limit));
      }
      accounts = await query.toArray();
    }
    const sectionsCollection = db.collection("sections");
    const activeSections = await sectionsCollection.find({
      status: "active"
    }).toArray();
    const adviserSectionMap = /* @__PURE__ */ new Map();
    activeSections.forEach((section) => {
      if (section.adviser_id) {
        adviserSectionMap.set(section.adviser_id.toString(), {
          name: section.name,
          grade_level: section.grade_level
        });
      }
    });
    const formattedAccounts = accounts.map((account) => {
      const accountId = account._id.toString();
      const advisorySection = adviserSectionMap.get(accountId);
      return {
        id: accountId,
        name: account.full_name,
        firstName: account.first_name,
        lastName: account.last_name,
        middleInitial: account.middle_initial,
        email: account.email,
        type: account.account_type === "student" ? "Student" : account.account_type === "teacher" ? "Teacher" : "Admin",
        number: account.account_number,
        gradeLevel: account.grade_level,
        birthdate: account.birthdate,
        address: account.address,
        age: account.age,
        guardian: account.guardian,
        contactNumber: account.contact_number,
        department: account.department_name || null,
        // Add department field for teachers
        advisorySection: advisorySection ? `${advisorySection.name} (Grade ${advisorySection.grade_level})` : null,
        createdDate: new Date(account.created_at).toLocaleDateString("en-US"),
        updatedDate: new Date(account.updated_at).toLocaleDateString("en-US"),
        status: "active"
      };
    });
    return json({ success: true, accounts: formattedAccounts });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}
async function PUT({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const { id, firstName, lastName, middleInitial, gradeLevel, birthdate, address, guardian, contactNumber } = await request.json();
    if (!id || !firstName || !lastName) {
      return json({ error: "Account ID, first name, and last name are required" }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    const existingAccount = await usersCollection.findOne({ _id: new ObjectId(id) });
    if (!existingAccount) {
      return json({ error: "Account not found" }, { status: 404 });
    }
    const accountType = existingAccount.account_type;
    const oldFullName = existingAccount.full_name;
    if (accountType === "student") {
      if (!birthdate || !address || !guardian || !contactNumber) {
        return json({ error: "Birthdate, address, guardian, and contact number are required for students" }, { status: 400 });
      }
    }
    let age = null;
    if (accountType === "student" && birthdate) {
      const birthDate = new Date(birthdate);
      const today = /* @__PURE__ */ new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || monthDiff === 0 && today.getDate() < birthDate.getDate()) {
        age--;
      }
    }
    const fullName = `${lastName}, ${firstName}${middleInitial ? " " + middleInitial + "." : ""}`;
    let updateDoc = {
      first_name: firstName,
      last_name: lastName,
      middle_initial: middleInitial || null,
      full_name: fullName,
      updated_at: /* @__PURE__ */ new Date()
    };
    if (accountType === "student") {
      updateDoc = {
        ...updateDoc,
        grade_level: gradeLevel || null,
        birthdate: birthdate ? new Date(birthdate) : null,
        address: address || null,
        age,
        guardian: guardian || null,
        contact_number: contactNumber || null
      };
    }
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );
    if (result.matchedCount === 0) {
      return json({ error: "Account not found" }, { status: 404 });
    }
    const updatedAccount = await usersCollection.findOne({ _id: new ObjectId(id) });
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "account_updated",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          account_type: updatedAccount.account_type,
          old_full_name: oldFullName,
          full_name: updatedAccount.full_name,
          account_number: updatedAccount.account_number
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging account update activity:", logError);
    }
    const response = {
      id: updatedAccount._id.toString(),
      name: updatedAccount.full_name,
      firstName: updatedAccount.first_name,
      lastName: updatedAccount.last_name,
      middleInitial: updatedAccount.middle_initial,
      type: updatedAccount.account_type === "student" ? "Student" : updatedAccount.account_type === "teacher" ? "Teacher" : "Admin",
      number: updatedAccount.account_number,
      gradeLevel: updatedAccount.grade_level,
      birthdate: updatedAccount.birthdate,
      address: updatedAccount.address,
      age: updatedAccount.age,
      guardian: updatedAccount.guardian,
      contactNumber: updatedAccount.contact_number,
      createdDate: new Date(updatedAccount.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(updatedAccount.updated_at).toLocaleDateString("en-US"),
      status: "active"
    };
    return json({
      success: true,
      message: `Account for "${updatedAccount.full_name}" has been updated successfully`,
      account: response
    });
  } catch (error) {
    console.error("Error updating account:", error);
    if (error.code === 11e3) {
      if (error.keyPattern && error.keyPattern.email) {
        return json({ error: "An account with this email already exists" }, { status: 409 });
      }
    }
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to update account. Please try again." }, { status: 500 });
  }
}
async function DELETE({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const { id } = await request.json();
    if (!id) {
      return json({ error: "Account ID is required" }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    const account = await usersCollection.findOne({ _id: new ObjectId(id) });
    if (!account) {
      return json({ error: "Account not found" }, { status: 404 });
    }
    const deleteResult = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    if (deleteResult.deletedCount === 0) {
      return json({ error: "Failed to delete account" }, { status: 500 });
    }
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "account_deleted",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          account_type: account.account_type,
          full_name: account.full_name,
          account_number: account.account_number
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging account deletion activity:", logError);
    }
    const accountTypeLabel = account.account_type === "student" ? "Student" : account.account_type === "teacher" ? "Teacher" : "Admin";
    return json({
      success: true,
      message: `${accountTypeLabel} "${account.full_name}" has been deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to delete account. Please try again." }, { status: 500 });
  }
}
async function generateAccountNumber(accountType) {
  const prefix = accountType === "student" ? "STU" : accountType === "teacher" ? "TCH" : "ADM";
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const db = client.db(process.env.MONGODB_DB_NAME);
  const usersCollection = db.collection("users");
  const existingAccounts = await usersCollection.find({
    account_number: { $regex: `^${prefix}-${year}-` }
  }).toArray();
  const existingNumbers = new Set(
    existingAccounts.map((account) => {
      const match = account.account_number.match(/-(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    }).filter((num) => num > 0)
    // Filter out invalid numbers
  );
  let nextNumber = 1;
  while (existingNumbers.has(nextNumber)) {
    nextNumber++;
  }
  return `${prefix}-${year}-${nextNumber.toString().padStart(4, "0")}`;
}
async function PATCH({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const { id, action } = await request.json();
    if (!id) {
      return json({ error: "Account ID is required" }, { status: 400 });
    }
    if (action !== "archive") {
      return json({ error: 'Invalid action. Only "archive" is supported.' }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const usersCollection = db.collection("users");
    const account = await usersCollection.findOne({ _id: new ObjectId(id) });
    if (!account) {
      return json({ error: "Account not found" }, { status: 404 });
    }
    if (account.account_type !== "student" && account.account_type !== "teacher") {
      return json({ error: "Only student and teacher accounts can be archived" }, { status: 400 });
    }
    const updateResult = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "archived",
          archived_at: /* @__PURE__ */ new Date(),
          updated_at: /* @__PURE__ */ new Date()
        }
      }
    );
    if (updateResult.matchedCount === 0) {
      return json({ error: "Account not found" }, { status: 404 });
    }
    const activityType = account.account_type === "student" ? "student_archived" : "teacher_archived";
    const accountTypeLabel = account.account_type === "student" ? "Student" : "Teacher";
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: activityType,
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.account_number || null,
        activity_data: {
          account_type: account.account_type,
          full_name: account.full_name,
          account_number: account.account_number
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging account archiving activity:", logError);
    }
    return json({
      success: true,
      message: `${accountTypeLabel} "${account.full_name}" has been archived successfully`
    });
  } catch (error) {
    console.error("Error archiving account:", error);
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({ error: "Database connection failed. Please try again." }, { status: 503 });
    }
    return json({ error: "Failed to archive account. Please try again." }, { status: 500 });
  }
}

export { DELETE, GET, PATCH, POST, PUT };
//# sourceMappingURL=_server-mw15yEgJ.js.map
