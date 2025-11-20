import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { verifyAuth } from '../helper/auth-helper.js';
import { ObjectId } from 'mongodb';

// GET /api/student-todos - Fetch todos for a student
export async function GET({ url }) {
  try {
    const studentId = url.searchParams.get('studentId');
    
    // Validate required parameter
    if (!studentId) {
      return json({ error: 'studentId parameter is required' }, { status: 400 });
    }

    const db = await connectToDatabase();

    // Verify the student exists and is a student account
    const student = await db.collection('users').findOne({
      _id: new ObjectId(studentId),
      account_type: 'student',
      $or: [{ status: { $exists: false } }, { status: 'active' }]
    });

    if (!student) {
      return json({ error: 'Student not found or invalid account type' }, { status: 404 });
    }

    // Fetch todos for the student, sorted by creation date (newest first)
    const todos = await db.collection('student_todos')
      .find({ student_id: studentId })
      .sort({ created_at: -1 })
      .toArray();

    // Format the todos for frontend consumption
    const formattedTodos = todos.map(todo => ({
      id: todo._id.toString(),
      title: todo.title,
      description: todo.description,
      category: todo.category,
      dueDate: todo.due_date ? todo.due_date.toISOString().split('T')[0] : null,
      completed: todo.completed,
      createdAt: todo.created_at,
      updatedAt: todo.updated_at,
      completedAt: todo.completed_at
    }));

    return json({ success: true, data: formattedTodos });

  } catch (error) {
    console.error('Error in GET /api/student-todos:', error);
    
    // Database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    return json({ error: 'Failed to fetch todos' }, { status: 500 });
  }
}

// POST /api/student-todos - Create a new todo
export async function POST({ request }) {
  try {
    const { studentId, title, description, category, dueDate } = await request.json();

    // Validate required fields
    if (!studentId || !title) {
      return json({ error: 'studentId and title are required' }, { status: 400 });
    }

    // Validate category
    const validCategories = ['assignment', 'study', 'personal', 'project', 'exam'];
    if (category && !validCategories.includes(category)) {
      return json({ error: 'Invalid category' }, { status: 400 });
    }

    const db = await connectToDatabase();

    // Verify the student exists and is a student account
    const student = await db.collection('users').findOne({
      _id: new ObjectId(studentId),
      account_type: 'student',
      $or: [{ status: { $exists: false } }, { status: 'active' }]
    });

    if (!student) {
      return json({ error: 'Student not found or invalid account type' }, { status: 404 });
    }

    console.log('Received dueDate:', dueDate);
    const processedDate = dueDate ? new Date(dueDate + 'T00:00:00.000Z') : null;
    console.log('Processed dueDate object:', processedDate);
    console.log('Processed dueDate ISO:', processedDate ? processedDate.toISOString() : null);

    // Create the new todo document
    const newTodo = {
      student_id: studentId,
      title: title.trim(),
      description: description ? description.trim() : null,
      category: category || 'personal',
      due_date: processedDate,
      completed: false,
      created_at: new Date(),
      updated_at: new Date(),
      completed_at: null
    };

    // Insert the new todo
    const result = await db.collection('student_todos').insertOne(newTodo);
    
    // Format the response
    const formattedTodo = {
      id: result.insertedId.toString(),
      title: newTodo.title,
      description: newTodo.description,
      category: newTodo.category,
      dueDate: newTodo.due_date ? newTodo.due_date.toISOString().split('T')[0] : null,
      completed: newTodo.completed,
      createdAt: newTodo.created_at,
      updatedAt: newTodo.updated_at,
      completedAt: newTodo.completed_at
    };

    return json({ success: true, data: formattedTodo }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/student-todos:', error);
    
    // Database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    return json({ error: 'Failed to create todo' }, { status: 500 });
  }
}

// DELETE /api/student-todos - Delete a todo
export async function DELETE({ request }) {
  try {
    const { id, studentId } = await request.json();

    // Validate required fields
    if (!id || !studentId) {
      return json({ error: 'id and studentId are required' }, { status: 400 });
    }

    const db = await connectToDatabase();

    // Verify the todo exists and belongs to the student
    const existingTodo = await db.collection('student_todos').findOne({
      _id: new ObjectId(id),
      student_id: studentId
    });

    if (!existingTodo) {
      return json({ error: 'Todo not found or access denied' }, { status: 404 });
    }

    // Verify the student exists and is active
    const student = await db.collection('users').findOne({
      _id: new ObjectId(studentId),
      account_type: 'student',
      $or: [{ status: { $exists: false } }, { status: 'active' }]
    });

    if (!student) {
      return json({ error: 'Student not found or invalid account type' }, { status: 404 });
    }

    // Delete the todo
    const result = await db.collection('student_todos').deleteOne({
      _id: new ObjectId(id),
      student_id: studentId
    });

    if (result.deletedCount === 0) {
      return json({ error: 'Todo not found' }, { status: 404 });
    }

    return json({ success: true, message: 'Todo deleted successfully' });

  } catch (error) {
    console.error('Error in DELETE /api/student-todos:', error);
    
    // Database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    return json({ error: 'Failed to delete todo' }, { status: 500 });
  }
}

// PUT /api/student-todos - Update a todo (toggle completion or update details)
export async function PUT({ request }) {
  try {
    const { id, studentId, action, ...updateData } = await request.json();

    // Validate required fields
    if (!id || !studentId || !action) {
      return json({ error: 'id, studentId, and action are required' }, { status: 400 });
    }

    // Validate action type
    const validActions = ['toggle', 'update'];
    if (!validActions.includes(action)) {
      return json({ error: 'Invalid action. Must be "toggle" or "update"' }, { status: 400 });
    }

    const db = await connectToDatabase();

    // Verify the todo exists and belongs to the student
    const existingTodo = await db.collection('student_todos').findOne({
      _id: new ObjectId(id),
      student_id: studentId
    });

    if (!existingTodo) {
      return json({ error: 'Todo not found or access denied' }, { status: 404 });
    }

    // Verify the student exists and is active
    const student = await db.collection('users').findOne({
      _id: new ObjectId(studentId),
      account_type: 'student',
      $or: [{ status: { $exists: false } }, { status: 'active' }]
    });

    if (!student) {
      return json({ error: 'Student not found or invalid account type' }, { status: 404 });
    }

    let updateFields = { updated_at: new Date() };

    if (action === 'toggle') {
      // Toggle completion status
      const newCompletedStatus = !existingTodo.completed;
      updateFields.completed = newCompletedStatus;
      updateFields.completed_at = newCompletedStatus ? new Date() : null;
    } else if (action === 'update') {
      // Update todo details
      const { title, description, category, dueDate } = updateData;

      if (title !== undefined) {
        if (!title.trim()) {
          return json({ error: 'Title cannot be empty' }, { status: 400 });
        }
        updateFields.title = title.trim();
      }

      if (description !== undefined) {
        updateFields.description = description ? description.trim() : null;
      }

      if (category !== undefined) {
        const validCategories = ['assignment', 'study', 'personal', 'project', 'exam'];
        if (!validCategories.includes(category)) {
          return json({ error: 'Invalid category' }, { status: 400 });
        }
        updateFields.category = category;
      }

      if (dueDate !== undefined) {
        updateFields.due_date = dueDate ? new Date(dueDate + 'T00:00:00.000Z') : null;
      }
    }

    // Update the todo
    const result = await db.collection('student_todos').updateOne(
      { _id: new ObjectId(id), student_id: studentId },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return json({ error: 'Todo not found' }, { status: 404 });
    }

    // Fetch the updated todo
    const updatedTodo = await db.collection('student_todos').findOne({
      _id: new ObjectId(id)
    });

    // Format the response
    const formattedTodo = {
      id: updatedTodo._id.toString(),
      title: updatedTodo.title,
      description: updatedTodo.description,
      category: updatedTodo.category,
      dueDate: updatedTodo.due_date ? updatedTodo.due_date.toISOString().split('T')[0] : null,
      completed: updatedTodo.completed,
      createdAt: updatedTodo.created_at,
      updatedAt: updatedTodo.updated_at,
      completedAt: updatedTodo.completed_at
    };

    return json({ success: true, data: formattedTodo });

  } catch (error) {
    console.error('Error in PUT /api/student-todos:', error);
    
    // Database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return json({ error: 'Database connection failed' }, { status: 503 });
    }
    
    return json({ error: 'Failed to update todo' }, { status: 500 });
  }
}