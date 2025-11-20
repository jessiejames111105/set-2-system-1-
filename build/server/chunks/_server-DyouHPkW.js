import { j as json } from './index-CccDCyu_.js';
import { c as client } from './db-C-gxO138.js';
import { v as verifyAuth, g as getUserFromRequest } from './auth-helper-DY2o5dhz.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

async function GET({ url, request }) {
  try {
    const authResult = await verifyAuth(request, ["admin", "teacher", "adviser"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const action = url.searchParams.get("action");
    const searchTerm = url.searchParams.get("search") || "";
    const gradeLevel = url.searchParams.get("grade_level");
    const db = client.db(process.env.MONGODB_DB_NAME);
    const subjectsCollection = db.collection("subjects");
    const departmentsCollection = db.collection("departments");
    if (action === "available-subjects") {
      let filter2 = {};
      if (gradeLevel && gradeLevel !== "") {
        filter2.grade_level = parseInt(gradeLevel);
      }
      const subjects2 = await subjectsCollection.find(filter2).sort({ name: 1 }).toArray();
      const subjectsWithDepartments2 = await Promise.all(
        subjects2.map(async (subject) => {
          let department = null;
          if (subject.department_id) {
            department = await departmentsCollection.findOne({ _id: new ObjectId(subject.department_id) });
          }
          return {
            id: subject._id.toString(),
            name: subject.name,
            code: subject.code,
            grade_level: subject.grade_level,
            gradeLevel: `Grade ${subject.grade_level}`,
            department_id: subject.department_id,
            department_name: department?.name || null,
            department_code: department?.code || null
          };
        })
      );
      return json({
        success: true,
        data: subjectsWithDepartments2
      });
    }
    let filter = {};
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { code: { $regex: searchTerm, $options: "i" } }
      ];
    }
    if (gradeLevel && gradeLevel !== "") {
      filter.grade_level = parseInt(gradeLevel);
    }
    const subjects = await subjectsCollection.find(filter).sort({ created_at: -1 }).toArray();
    const subjectsWithDepartments = await Promise.all(
      subjects.map(async (subject) => {
        let department = null;
        if (subject.department_id) {
          department = await departmentsCollection.findOne({ _id: new ObjectId(subject.department_id) });
        }
        return {
          id: subject._id.toString(),
          name: subject.name,
          code: subject.code,
          grade_level: subject.grade_level,
          gradeLevel: `Grade ${subject.grade_level}`,
          department_id: subject.department_id,
          department_name: department?.name || null,
          department_code: department?.code || null,
          icon: "book",
          createdDate: new Date(subject.created_at).toLocaleDateString("en-US"),
          updatedDate: new Date(subject.updated_at).toLocaleDateString("en-US")
        };
      })
    );
    return json({
      success: true,
      data: subjectsWithDepartments
    });
  } catch (error) {
    console.error("Error fetching subjects:", error);
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({
        success: false,
        message: "Database connection failed"
      }, { status: 503 });
    }
    return json({
      success: false,
      message: "Failed to fetch subjects: " + error.message
    }, { status: 500 });
  }
}
async function POST({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const data = await request.json();
    const { name, code, gradeLevel, department_id } = data;
    if (!name || !code || !gradeLevel) {
      return json({
        success: false,
        message: "Name, code, and grade level are required"
      }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const subjectsCollection = db.collection("subjects");
    const existingSubject = await subjectsCollection.findOne({ code });
    if (existingSubject) {
      return json({
        success: false,
        message: "Subject code already exists"
      }, { status: 409 });
    }
    const newSubject = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      grade_level: parseInt(gradeLevel),
      department_id: department_id || null,
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date()
    };
    const result = await subjectsCollection.insertOne(newSubject);
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "subject_created",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          name: newSubject.name,
          code: newSubject.code,
          grade_level: newSubject.grade_level
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging subject creation activity:", logError);
    }
    const formattedSubject = {
      id: result.insertedId.toString(),
      name: newSubject.name,
      code: newSubject.code,
      gradeLevel: `Grade ${newSubject.grade_level}`,
      createdDate: new Date(newSubject.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(newSubject.updated_at).toLocaleDateString("en-US")
    };
    return json({
      success: true,
      message: `Subject "${name}" created successfully`,
      data: formattedSubject
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating subject:", error);
    if (error.code === 11e3) {
      return json({
        success: false,
        message: "Subject code already exists"
      }, { status: 409 });
    }
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({
        success: false,
        message: "Database connection failed"
      }, { status: 503 });
    }
    return json({
      success: false,
      message: "Failed to create subject: " + error.message
    }, { status: 500 });
  }
}
async function PUT({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const data = await request.json();
    const { id, name, code, gradeLevel, department_id } = data;
    if (!id || !name || !code || !gradeLevel) {
      return json({
        success: false,
        message: "ID, name, code, and grade level are required"
      }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const subjectsCollection = db.collection("subjects");
    const existingSubject = await subjectsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingSubject) {
      return json({
        success: false,
        message: "Subject not found"
      }, { status: 404 });
    }
    if (code !== existingSubject.code) {
      const codeExists = await subjectsCollection.findOne({
        code,
        _id: { $ne: new ObjectId(id) }
      });
      if (codeExists) {
        return json({
          success: false,
          message: "Subject code already exists"
        }, { status: 409 });
      }
    }
    const updateData = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      grade_level: parseInt(gradeLevel),
      department_id: department_id || null,
      updated_at: /* @__PURE__ */ new Date()
    };
    const result = await subjectsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    if (result.matchedCount === 0) {
      return json({
        success: false,
        message: "Subject not found"
      }, { status: 404 });
    }
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "subject_updated",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          id,
          name: updateData.name,
          code: updateData.code,
          grade_level: updateData.grade_level,
          previous_name: existingSubject.name,
          previous_code: existingSubject.code,
          previous_grade_level: existingSubject.grade_level
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging subject update activity:", logError);
    }
    const updatedSubject = await subjectsCollection.findOne({ _id: new ObjectId(id) });
    let department = null;
    if (updatedSubject.department_id) {
      const departmentsCollection = db.collection("departments");
      department = await departmentsCollection.findOne({ _id: new ObjectId(updatedSubject.department_id) });
    }
    const formattedSubject = {
      id: updatedSubject._id.toString(),
      name: updatedSubject.name,
      code: updatedSubject.code,
      grade_level: updatedSubject.grade_level,
      gradeLevel: `Grade ${updatedSubject.grade_level}`,
      department_id: updatedSubject.department_id,
      department_name: department?.name || null,
      department_code: department?.code || null,
      icon: "book",
      createdDate: new Date(updatedSubject.created_at).toLocaleDateString("en-US"),
      updatedDate: new Date(updatedSubject.updated_at).toLocaleDateString("en-US")
    };
    return json({
      success: true,
      message: `Subject "${name}" updated successfully`,
      data: formattedSubject
    });
  } catch (error) {
    console.error("Error updating subject:", error);
    if (error.code === 11e3) {
      return json({
        success: false,
        message: "Subject code already exists"
      }, { status: 409 });
    }
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({
        success: false,
        message: "Database connection failed"
      }, { status: 503 });
    }
    return json({
      success: false,
      message: "Failed to update subject: " + error.message
    }, { status: 500 });
  }
}
async function DELETE({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const data = await request.json();
    const { id } = data;
    if (!id) {
      return json({
        success: false,
        message: "Subject ID is required"
      }, { status: 400 });
    }
    const db = client.db(process.env.MONGODB_DB_NAME);
    const subjectsCollection = db.collection("subjects");
    const existingSubject = await subjectsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingSubject) {
      return json({
        success: false,
        message: "Subject not found"
      }, { status: 404 });
    }
    const result = await subjectsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return json({
        success: false,
        message: "Subject not found"
      }, { status: 404 });
    }
    try {
      const user = await getUserFromRequest(request);
      const ip_address = getClientAddress();
      const user_agent = request.headers.get("user-agent");
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "subject_deleted",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          subject_code: existingSubject.code,
          subject_name: existingSubject.name,
          subject_id: id
        },
        ip_address,
        user_agent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging subject deletion activity:", logError);
    }
    return json({
      success: true,
      message: `Subject "${existingSubject.name} (${existingSubject.code})" has been removed successfully`
    });
  } catch (error) {
    console.error("Error deleting subject:", error);
    if (error.name === "MongoNetworkError" || error.name === "MongoServerError") {
      return json({
        success: false,
        message: "Database connection failed"
      }, { status: 503 });
    }
    return json({
      success: false,
      message: "Failed to delete subject: " + error.message
    }, { status: 500 });
  }
}

export { DELETE, GET, POST, PUT };
//# sourceMappingURL=_server-DyouHPkW.js.map
