import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../../database/db.js';
import { ObjectId } from 'mongodb';
import { verifyAuth } from '../../helper/auth-helper.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, request }) {
  try {
    // Verify authentication - only teachers, advisers, and admins can access grade items
    const authResult = await verifyAuth(request, ['teacher', 'adviser', 'admin']);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: 401 });
    }
    const currentUser = authResult.user;
    
    const sectionId = url.searchParams.get('section_id');
    const subjectId = url.searchParams.get('subject_id');
    const gradingPeriodId = url.searchParams.get('grading_period_id');
    const teacherId = url.searchParams.get('teacher_id');

    // Validate required fields
    if (!sectionId || !subjectId || !gradingPeriodId) {
      return json({ 
        error: 'Missing required parameters: section_id, subject_id, grading_period_id' 
      }, { status: 400 });
    }
    
    // Authorization check: teachers can only access their own grade items
    if (currentUser.account_type === 'teacher' && teacherId && teacherId !== currentUser.id) {
      return json({ error: 'Unauthorized: You can only access your own grade items' }, { status: 403 });
    }

    const db = await connectToDatabase();

    console.log('Grade items API - Query parameters:', {
      section_id: sectionId,
      subject_id: subjectId,
      grading_period_id: gradingPeriodId,
      teacher_id: teacherId
    });

    // Check if there are any existing grade configurations in MongoDB
    const existingConfig = await db.collection('grade_configurations').findOne({
      section_id: new ObjectId(sectionId),
      subject_id: new ObjectId(subjectId),
      grading_period_id: parseInt(gradingPeriodId),
      teacher_id: new ObjectId(teacherId)
    });

    console.log('Existing config found:', existingConfig ? 'YES' : 'NO');
    if (existingConfig) {
      console.log('Config data:', existingConfig.grade_items);
    }

    let gradeItemsByCategory;

    if (existingConfig) {
      gradeItemsByCategory = existingConfig.grade_items;
    } else {
      // Start with empty configuration - no mock data
      gradeItemsByCategory = {
        writtenWork: [],
        performanceTasks: [],
        quarterlyAssessment: []
      };
      
      // Save the empty configuration to MongoDB for future use
      await db.collection('grade_configurations').insertOne({
        section_id: new ObjectId(sectionId),
        subject_id: new ObjectId(subjectId),
        grading_period_id: parseInt(gradingPeriodId),
        teacher_id: new ObjectId(teacherId),
        grade_items: gradeItemsByCategory,
        created_at: new Date(),
        updated_at: new Date(),
        status: 'active'
      });
    }

    return json({
      success: true,
      data: gradeItemsByCategory
    });

  } catch (error) {
    console.error('Error in grades/grade-items GET:', error);
    return json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    // Verify authentication - only teachers, advisers, and admins can modify grade items
    const authResult = await verifyAuth(request, ['teacher', 'adviser', 'admin']);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: 401 });
    }
    const currentUser = authResult.user;
    
    const { action, ...data } = await request.json();
    const db = await connectToDatabase();

    switch (action) {
      case 'create_grade_item':
        const { section_id, subject_id, grading_period_id, teacher_id, category, name, total_score } = data;
        
        // Authorization check: teachers can only create grade items for their own classes
        if (currentUser.account_type === 'teacher' && teacher_id && teacher_id !== currentUser.id) {
          return json({ error: 'Unauthorized: You can only create grade items for your own classes' }, { status: 403 });
        }
        
        // Find existing configuration
        const config = await db.collection('grade_configurations').findOne({
          section_id: new ObjectId(section_id),
          subject_id: new ObjectId(subject_id),
          grading_period_id: parseInt(grading_period_id),
          teacher_id: new ObjectId(teacher_id)
        });

        if (config) {
          // Add new grade item to the appropriate category
          const newItem = {
            id: new ObjectId().toString(),
            name,
            totalScore: total_score
          };

          const updatePath = `grade_items.${category}`;
          await db.collection('grade_configurations').updateOne(
            { _id: config._id },
            { 
              $push: { [updatePath]: newItem },
              $set: { updated_at: new Date() }
            }
          );

          return json({ success: true, data: newItem });
        } else {
          return json({ 
            success: false, 
            error: 'Grade configuration not found' 
          }, { status: 404 });
        }

      case 'update_grade_item':
        const { item_id, new_name, new_total_score } = data;
        
        // Update grade item in the configuration
        const updateResult = await db.collection('grade_configurations').updateOne(
          {
            $or: [
              { 'grade_items.writtenWork.id': item_id },
              { 'grade_items.performanceTasks.id': item_id },
              { 'grade_items.quarterlyAssessment.id': item_id }
            ]
          },
          {
            $set: {
              'grade_items.writtenWork.$[elem].name': new_name,
              'grade_items.writtenWork.$[elem].totalScore': new_total_score,
              'grade_items.performanceTasks.$[elem].name': new_name,
              'grade_items.performanceTasks.$[elem].totalScore': new_total_score,
              'grade_items.quarterlyAssessment.$[elem].name': new_name,
              'grade_items.quarterlyAssessment.$[elem].totalScore': new_total_score,
              updated_at: new Date()
            }
          },
          {
            arrayFilters: [{ 'elem.id': item_id }]
          }
        );

        return json({ success: true });

      case 'delete_grade_item':
      case 'remove':
        // Accept either delete_item_id or grade_item_id from different frontend callers
        const gradeItemId = data.delete_item_id || data.grade_item_id;

        if (!gradeItemId) {
          return json({ success: false, error: 'Missing grade item id' }, { status: 400 });
        }

        // Remove grade item from all categories - only update documents with valid grade_items
        await db.collection('grade_configurations').updateMany(
          {
            grade_items: { $exists: true, $ne: null }
          },
          {
            $pull: {
              'grade_items.writtenWork': { id: gradeItemId },
              'grade_items.performanceTasks': { id: gradeItemId },
              'grade_items.quarterlyAssessment': { id: gradeItemId }
            },
            $set: { updated_at: new Date() }
          }
        );

        return json({ success: true });

      default:
        return json({ 
          success: false, 
          error: 'Invalid action' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in grades/grade-items POST:', error);
    return json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/** @type {import('./$types').RequestHandler} */
export async function PUT({ request }) {
  try {
    // Verify authentication - only teachers, advisers, and admins can update grade items
    const authResult = await verifyAuth(request, ['teacher', 'adviser', 'admin']);
    if (!authResult.success) {
      return json({ error: authResult.error }, { status: 401 });
    }
    const currentUser = authResult.user;
    
    const data = await request.json();
    const db = await connectToDatabase();

    // Check if this is an individual grade item update (from frontend)
    if (data.grade_item_id && (data.name !== undefined || data.total_score !== undefined)) {
      const { grade_item_id, name, total_score } = data;

      // Build the update object dynamically based on what fields are provided
      const updateFields = {};
      if (name !== undefined) {
        updateFields['grade_items.writtenWork.$[elem].name'] = name;
        updateFields['grade_items.performanceTasks.$[elem].name'] = name;
        updateFields['grade_items.quarterlyAssessment.$[elem].name'] = name;
      }
      if (total_score !== undefined) {
        updateFields['grade_items.writtenWork.$[elem].totalScore'] = total_score;
        updateFields['grade_items.performanceTasks.$[elem].totalScore'] = total_score;
        updateFields['grade_items.quarterlyAssessment.$[elem].totalScore'] = total_score;
      }
      updateFields['updated_at'] = new Date();

      // Update the specific grade item across all categories
      const result = await db.collection('grade_configurations').updateOne(
        {
          $or: [
            { 'grade_items.writtenWork.id': grade_item_id },
            { 'grade_items.performanceTasks.id': grade_item_id },
            { 'grade_items.quarterlyAssessment.id': grade_item_id }
          ]
        },
        {
          $set: updateFields
        },
        {
          arrayFilters: [{ 'elem.id': grade_item_id }]
        }
      );

      if (result.matchedCount === 0) {
        return json({ 
          success: false, 
          error: 'Grade item not found' 
        }, { status: 404 });
      }

      return json({ success: true });
    }

    // Original bulk update functionality for backward compatibility
    const { section_id, subject_id, grading_period_id, teacher_id, grade_items } = data;
    
    // Authorization check: teachers can only update their own grade items
    if (currentUser.account_type === 'teacher' && teacher_id && teacher_id !== currentUser.id) {
      return json({ error: 'Unauthorized: You can only update your own grade items' }, { status: 403 });
    }

    // Update or create grade configuration
    const result = await db.collection('grade_configurations').updateOne(
      {
        section_id,
        subject_id,
        grading_period_id: parseInt(grading_period_id),
        teacher_id
      },
      {
        $set: {
          grade_items,
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date(),
          status: 'active'
        }
      },
      { upsert: true }
    );

    return json({ success: true });

  } catch (error) {
    console.error('Error in grades/grade-items PUT:', error);
    return json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ url, request }) {
  try {
    console.log('DELETE /api/grades/grade-items - Starting request');
    
    // Verify authentication - only teachers, advisers, and admins can delete grade items
    const authResult = await verifyAuth(request, ['teacher', 'adviser', 'admin']);
    if (!authResult.success) {
      console.log('Authentication failed:', authResult.error);
      return json({ error: authResult.error }, { status: 401 });
    }
    const currentUser = authResult.user;
    console.log('User authenticated:', { id: currentUser.id, account_type: currentUser.account_type });
    
    const db = await connectToDatabase();
    console.log('Database connected');

    // Try to read JSON body in case the client sent a grade_item_id in the body
    let body = {};
    try {
      const text = await request.text();
      console.log('Request body text:', text);
      if (text) {
        body = JSON.parse(text);
        console.log('Parsed body:', body);
      }
    } catch (err) {
      console.log('No JSON body or failed to parse:', err.message);
      body = {};
    }

    // If a specific grade_item_id is provided in the body, remove that item from all configs
    if (body && body.grade_item_id) {
      const gradeItemId = body.grade_item_id;
      
      console.log('Deleting grade item:', gradeItemId);

      // Only update documents where grade_items exists and is not null
      const result = await db.collection('grade_configurations').updateMany(
        {
          grade_items: { $exists: true, $ne: null }
        },
        {
          $pull: {
            'grade_items.writtenWork': { id: gradeItemId },
            'grade_items.performanceTasks': { id: gradeItemId },
            'grade_items.quarterlyAssessment': { id: gradeItemId }
          },
          $set: { updated_at: new Date() }
        }
      );
      
      console.log('Delete result:', { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount });

      return json({ success: true, message: 'Grade item deleted successfully' });
    }

    console.log('No grade_item_id in body, checking query params');

    // Fallback: delete whole grade configuration if query params are provided
    const sectionId = url.searchParams.get('section_id');
    const subjectId = url.searchParams.get('subject_id');
    const gradingPeriodId = url.searchParams.get('grading_period_id');
    const teacherId = url.searchParams.get('teacher_id');

    if (!sectionId || !subjectId || !gradingPeriodId || !teacherId) {
      return json({ 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }
    
    // Authorization check: teachers can only delete their own grade items
    if (currentUser.account_type === 'teacher' && teacherId && teacherId !== currentUser.id) {
      return json({ error: 'Unauthorized: You can only delete your own grade items' }, { status: 403 });
    }

    // Convert to ObjectId where appropriate to match how configs are stored
    await db.collection('grade_configurations').deleteOne({
      section_id: new ObjectId(sectionId),
      subject_id: new ObjectId(subjectId),
      grading_period_id: parseInt(gradingPeriodId),
      teacher_id: new ObjectId(teacherId)
    });

    return json({ success: true });

  } catch (error) {
    console.error('Error in grades/grade-items DELETE:', error);
    console.error('Error stack:', error.stack);
    return json({ 
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}