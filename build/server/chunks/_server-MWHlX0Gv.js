import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

async function GET({ url }) {
  try {
    const studentId = url.searchParams.get("studentId");
    if (!studentId) {
      return json({ error: "studentId parameter is required" }, { status: 400 });
    }
    const db = await connectToDatabase();
    const student = await db.collection("users").findOne({
      _id: new ObjectId(studentId),
      account_type: "student",
      $or: [{ status: { $exists: false } }, { status: "active" }]
    });
    if (!student) {
      return json({ error: "Student not found or invalid account type" }, { status: 404 });
    }
    const todos = await db.collection("student_todos").find({ student_id: studentId }).sort({ created_at: -1 }).toArray();
    const formattedTodos = todos.map((todo) => ({
      id: todo._id.toString(),
      title: todo.title,
      description: todo.description,
      category: todo.category,
      dueDate: todo.due_date ? todo.due_date.toISOString().split("T")[0] : null,
      completed: todo.completed,
      createdAt: todo.created_at,
      updatedAt: todo.updated_at,
      completedAt: todo.completed_at
    }));
    return json({ success: true, data: formattedTodos });
  } catch (error) {
    console.error("Error in GET /api/student-todos:", error);
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to fetch todos" }, { status: 500 });
  }
}
async function POST({ request }) {
  try {
    const { studentId, title, description, category, dueDate } = await request.json();
    if (!studentId || !title) {
      return json({ error: "studentId and title are required" }, { status: 400 });
    }
    const validCategories = ["assignment", "study", "personal", "project", "exam"];
    if (category && !validCategories.includes(category)) {
      return json({ error: "Invalid category" }, { status: 400 });
    }
    const db = await connectToDatabase();
    const student = await db.collection("users").findOne({
      _id: new ObjectId(studentId),
      account_type: "student",
      $or: [{ status: { $exists: false } }, { status: "active" }]
    });
    if (!student) {
      return json({ error: "Student not found or invalid account type" }, { status: 404 });
    }
    console.log("Received dueDate:", dueDate);
    const processedDate = dueDate ? /* @__PURE__ */ new Date(dueDate + "T00:00:00.000Z") : null;
    console.log("Processed dueDate object:", processedDate);
    console.log("Processed dueDate ISO:", processedDate ? processedDate.toISOString() : null);
    const newTodo = {
      student_id: studentId,
      title: title.trim(),
      description: description ? description.trim() : null,
      category: category || "personal",
      due_date: processedDate,
      completed: false,
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date(),
      completed_at: null
    };
    const result = await db.collection("student_todos").insertOne(newTodo);
    const formattedTodo = {
      id: result.insertedId.toString(),
      title: newTodo.title,
      description: newTodo.description,
      category: newTodo.category,
      dueDate: newTodo.due_date ? newTodo.due_date.toISOString().split("T")[0] : null,
      completed: newTodo.completed,
      createdAt: newTodo.created_at,
      updatedAt: newTodo.updated_at,
      completedAt: newTodo.completed_at
    };
    return json({ success: true, data: formattedTodo }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/student-todos:", error);
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to create todo" }, { status: 500 });
  }
}
async function DELETE({ request }) {
  try {
    const { id, studentId } = await request.json();
    if (!id || !studentId) {
      return json({ error: "id and studentId are required" }, { status: 400 });
    }
    const db = await connectToDatabase();
    const existingTodo = await db.collection("student_todos").findOne({
      _id: new ObjectId(id),
      student_id: studentId
    });
    if (!existingTodo) {
      return json({ error: "Todo not found or access denied" }, { status: 404 });
    }
    const student = await db.collection("users").findOne({
      _id: new ObjectId(studentId),
      account_type: "student",
      $or: [{ status: { $exists: false } }, { status: "active" }]
    });
    if (!student) {
      return json({ error: "Student not found or invalid account type" }, { status: 404 });
    }
    const result = await db.collection("student_todos").deleteOne({
      _id: new ObjectId(id),
      student_id: studentId
    });
    if (result.deletedCount === 0) {
      return json({ error: "Todo not found" }, { status: 404 });
    }
    return json({ success: true, message: "Todo deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /api/student-todos:", error);
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to delete todo" }, { status: 500 });
  }
}
async function PUT({ request }) {
  try {
    const { id, studentId, action, ...updateData } = await request.json();
    if (!id || !studentId || !action) {
      return json({ error: "id, studentId, and action are required" }, { status: 400 });
    }
    const validActions = ["toggle", "update"];
    if (!validActions.includes(action)) {
      return json({ error: 'Invalid action. Must be "toggle" or "update"' }, { status: 400 });
    }
    const db = await connectToDatabase();
    const existingTodo = await db.collection("student_todos").findOne({
      _id: new ObjectId(id),
      student_id: studentId
    });
    if (!existingTodo) {
      return json({ error: "Todo not found or access denied" }, { status: 404 });
    }
    const student = await db.collection("users").findOne({
      _id: new ObjectId(studentId),
      account_type: "student",
      $or: [{ status: { $exists: false } }, { status: "active" }]
    });
    if (!student) {
      return json({ error: "Student not found or invalid account type" }, { status: 404 });
    }
    let updateFields = { updated_at: /* @__PURE__ */ new Date() };
    if (action === "toggle") {
      const newCompletedStatus = !existingTodo.completed;
      updateFields.completed = newCompletedStatus;
      updateFields.completed_at = newCompletedStatus ? /* @__PURE__ */ new Date() : null;
    } else if (action === "update") {
      const { title, description, category, dueDate } = updateData;
      if (title !== void 0) {
        if (!title.trim()) {
          return json({ error: "Title cannot be empty" }, { status: 400 });
        }
        updateFields.title = title.trim();
      }
      if (description !== void 0) {
        updateFields.description = description ? description.trim() : null;
      }
      if (category !== void 0) {
        const validCategories = ["assignment", "study", "personal", "project", "exam"];
        if (!validCategories.includes(category)) {
          return json({ error: "Invalid category" }, { status: 400 });
        }
        updateFields.category = category;
      }
      if (dueDate !== void 0) {
        updateFields.due_date = dueDate ? /* @__PURE__ */ new Date(dueDate + "T00:00:00.000Z") : null;
      }
    }
    const result = await db.collection("student_todos").updateOne(
      { _id: new ObjectId(id), student_id: studentId },
      { $set: updateFields }
    );
    if (result.matchedCount === 0) {
      return json({ error: "Todo not found" }, { status: 404 });
    }
    const updatedTodo = await db.collection("student_todos").findOne({
      _id: new ObjectId(id)
    });
    const formattedTodo = {
      id: updatedTodo._id.toString(),
      title: updatedTodo.title,
      description: updatedTodo.description,
      category: updatedTodo.category,
      dueDate: updatedTodo.due_date ? updatedTodo.due_date.toISOString().split("T")[0] : null,
      completed: updatedTodo.completed,
      createdAt: updatedTodo.created_at,
      updatedAt: updatedTodo.updated_at,
      completedAt: updatedTodo.completed_at
    };
    return json({ success: true, data: formattedTodo });
  } catch (error) {
    console.error("Error in PUT /api/student-todos:", error);
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return json({ error: "Database connection failed" }, { status: 503 });
    }
    return json({ error: "Failed to update todo" }, { status: 500 });
  }
}

export { DELETE, GET, POST, PUT };
//# sourceMappingURL=_server-MWHlX0Gv.js.map
