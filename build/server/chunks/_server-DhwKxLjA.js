import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { g as getUserFromRequest } from './auth-helper-DY2o5dhz.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

async function GET({ url, request }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }
    if (user.account_type !== "admin") {
      return json({ error: "Admin access required" }, { status: 403 });
    }
    const limit = url.searchParams.get("limit");
    const search = url.searchParams.get("search") || "";
    const gradeLevel = url.searchParams.get("gradeLevel") || "";
    const gender = url.searchParams.get("gender") || "";
    const accountType = url.searchParams.get("type") || "";
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");
    const query = {
      account_type: { $in: ["student", "teacher"] },
      status: "archived"
    };
    if (accountType && (accountType === "student" || accountType === "teacher")) {
      query.account_type = accountType;
    }
    if (search) {
      query.$or = [
        { full_name: { $regex: search, $options: "i" } },
        { account_number: { $regex: search, $options: "i" } },
        { first_name: { $regex: search, $options: "i" } },
        { last_name: { $regex: search, $options: "i" } }
      ];
    }
    if (gradeLevel) {
      query.grade_level = gradeLevel;
    }
    if (gender) {
      query.gender = gender;
    }
    let queryBuilder = usersCollection.find(query).sort({ archived_at: -1 });
    if (limit && !isNaN(parseInt(limit))) {
      queryBuilder = queryBuilder.limit(parseInt(limit));
    }
    const archivedAccounts = await queryBuilder.toArray();
    const accountsWithDepartments = await Promise.all(
      archivedAccounts.map(async (account) => {
        if (account.account_type === "teacher") {
          const teacherDepartmentsCollection = db.collection("teacher_departments");
          const departmentsCollection = db.collection("departments");
          const teacherDept = await teacherDepartmentsCollection.findOne({
            teacher_id: account._id
          });
          let departmentName = null;
          if (teacherDept) {
            const department = await departmentsCollection.findOne({
              _id: teacherDept.department_id
            });
            departmentName = department ? department.name : null;
          }
          return { ...account, department_name: departmentName };
        }
        return account;
      })
    );
    const formattedAccounts = accountsWithDepartments.map((account) => ({
      id: account._id.toString(),
      name: account.full_name,
      firstName: account.first_name,
      lastName: account.last_name,
      middleInitial: account.middle_initial,
      email: account.email,
      number: account.account_number,
      accountType: account.account_type,
      gradeLevel: account.grade_level,
      department: account.department_name || null,
      birthdate: account.birthdate,
      address: account.address,
      age: account.age,
      guardian: account.guardian,
      contactNumber: account.contact_number,
      gender: account.gender,
      archivedDate: account.archived_at ? new Date(account.archived_at).toLocaleDateString("en-US") : "",
      createdDate: new Date(account.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(account.updated_at).toLocaleDateString("en-US"),
      status: "archived"
    }));
    return json({ accounts: formattedAccounts });
  } catch (error) {
    console.error("Error fetching archived accounts:", error);
    if (error.message === "Authentication required" || error.message === "Admin access required") {
      return json({ error: error.message }, { status: error.message === "Authentication required" ? 401 : 403 });
    }
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to fetch archived accounts" }, { status: 500 });
  }
}
async function PUT({ request, getClientAddress }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }
    if (user.account_type !== "admin") {
      return json({ error: "Admin access required" }, { status: 403 });
    }
    const { id } = await request.json();
    if (!id) {
      return json({ error: "Account ID is required" }, { status: 400 });
    }
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");
    const account = await usersCollection.findOne({
      _id: new ObjectId(id),
      account_type: { $in: ["student", "teacher"] }
    });
    if (!account) {
      return json({ error: "Account not found" }, { status: 404 });
    }
    if (account.status !== "archived") {
      return json({ error: "Account is not archived" }, { status: 400 });
    }
    const updateResult = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "active",
          updated_at: /* @__PURE__ */ new Date()
        },
        $unset: {
          archived_at: ""
        }
      }
    );
    if (updateResult.matchedCount === 0) {
      return json({ error: "Account not found" }, { status: 404 });
    }
    const restoredAccount = await usersCollection.findOne({ _id: new ObjectId(id) });
    const accountTypeLabel = restoredAccount.account_type === "student" ? "Student" : "Teacher";
    const activityType = restoredAccount.account_type === "student" ? "student_restored" : "teacher_restored";
    try {
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: activityType,
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.account_number || null,
        activity_data: {
          account_type: restoredAccount.account_type,
          full_name: restoredAccount.full_name,
          account_number: restoredAccount.account_number
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging account restoration activity:", logError);
    }
    return json({
      success: true,
      message: `${accountTypeLabel} ${restoredAccount.full_name} (${restoredAccount.account_number}) has been restored from archive`,
      account: {
        id: restoredAccount._id.toString(),
        name: restoredAccount.full_name,
        number: restoredAccount.account_number,
        type: restoredAccount.account_type
      }
    });
  } catch (error) {
    console.error("Error restoring account:", error);
    if (error.message === "Authentication required" || error.message === "Admin access required") {
      return json({ error: error.message }, { status: error.message === "Authentication required" ? 401 : 403 });
    }
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to restore account from archive" }, { status: 500 });
  }
}

export { GET, PUT };
//# sourceMappingURL=_server-DhwKxLjA.js.map
