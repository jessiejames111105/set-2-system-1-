import { j as json } from './index-CccDCyu_.js';
import { c as client } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import { g as getUserFromRequest } from './auth-helper-DY2o5dhz.js';
import 'dotenv';

async function GET({ url }) {
  try {
    const action = url.searchParams.get("action");
    await client.connect();
    const db = client.db("set-2-system");
    switch (action) {
      case "subjects":
        const subjectsCollection = db.collection("subjects");
        const subjectsResult = await subjectsCollection.aggregate([
          {
            $lookup: {
              from: "departments",
              localField: "department_id",
              foreignField: "_id",
              as: "department"
            }
          },
          {
            $unwind: {
              path: "$department",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              id: { $toString: "$_id" },
              name: 1,
              code: 1,
              grade_level: 1,
              created_at: 1,
              department_id: { $toString: "$department_id" },
              department_name: "$department.name",
              department_code: "$department.code"
            }
          },
          {
            $sort: { grade_level: 1, name: 1 }
          }
        ]).toArray();
        return json({ success: true, data: subjectsResult });
      case "teachers":
        const usersCollection = db.collection("users");
        const teacherDepartmentsCollection = db.collection("teacher_departments");
        const teachersResult = await usersCollection.aggregate([
          {
            $match: {
              account_type: "teacher",
              status: "active"
            }
          },
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
            $project: {
              id: { $toString: "$_id" },
              account_number: 1,
              first_name: 1,
              last_name: 1,
              full_name: 1,
              email: 1,
              status: 1,
              departments: {
                $map: {
                  input: "$departments",
                  as: "dept",
                  in: {
                    id: { $toString: "$$dept._id" },
                    name: "$$dept.name",
                    code: "$$dept.code"
                  }
                }
              }
            }
          },
          {
            $sort: { full_name: 1 }
          }
        ]).toArray();
        return json({ success: true, data: teachersResult });
      case "departments":
      default:
        const departmentsCollection = db.collection("departments");
        const departmentsResult = await departmentsCollection.aggregate([
          {
            $lookup: {
              from: "subjects",
              localField: "_id",
              foreignField: "department_id",
              as: "subjects"
            }
          },
          {
            $lookup: {
              from: "teacher_departments",
              localField: "_id",
              foreignField: "department_id",
              as: "teacher_departments"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "teacher_departments.teacher_id",
              foreignField: "_id",
              as: "teachers_data"
            }
          },
          {
            $project: {
              id: { $toString: "$_id" },
              name: 1,
              code: 1,
              created_at: 1,
              subjects: {
                $map: {
                  input: "$subjects",
                  as: "subject",
                  in: {
                    id: { $toString: "$$subject._id" },
                    name: "$$subject.name",
                    code: "$$subject.code",
                    grade_level: "$$subject.grade_level"
                  }
                }
              },
              subject_count: { $size: "$subjects" },
              teachers: {
                $map: {
                  input: {
                    $filter: {
                      input: "$teachers_data",
                      as: "teacher",
                      cond: { $eq: ["$$teacher.status", "active"] }
                    }
                  },
                  as: "teacher",
                  in: {
                    id: { $toString: "$$teacher._id" },
                    full_name: "$$teacher.full_name",
                    account_number: "$$teacher.account_number"
                  }
                }
              },
              teacher_count: {
                $size: {
                  $filter: {
                    input: "$teachers_data",
                    as: "teacher",
                    cond: { $eq: ["$$teacher.status", "active"] }
                  }
                }
              }
            }
          },
          {
            $sort: { name: 1 }
          }
        ]).toArray();
        return json({ success: true, data: departmentsResult });
    }
  } catch (error) {
    console.error("Error fetching departments data:", error);
    return json({ success: false, error: "Failed to fetch data" }, { status: 500 });
  }
}
async function POST({ request, getClientAddress }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { name, code, teachers = [] } = await request.json();
    if (!name || !code) {
      return json({ success: false, error: "Department name and code are required" }, { status: 400 });
    }
    await client.connect();
    const db = client.db("set-2-system");
    const departmentsCollection = db.collection("departments");
    const teacherDepartmentsCollection = db.collection("teacher_departments");
    const usersCollection = db.collection("users");
    const existingDept = await departmentsCollection.findOne({
      $or: [
        { name },
        { code: code.toUpperCase() }
      ]
    });
    if (existingDept) {
      return json({ success: false, error: "Department name or code already exists" }, { status: 400 });
    }
    const newDepartment = {
      name,
      code: code.toUpperCase(),
      status: "active",
      created_at: /* @__PURE__ */ new Date()
    };
    const insertResult = await departmentsCollection.insertOne(newDepartment);
    if (!insertResult.insertedId) {
      throw new Error("Failed to create department");
    }
    newDepartment.id = insertResult.insertedId.toString();
    newDepartment._id = insertResult.insertedId;
    if (teachers.length > 0) {
      const assignedTeachers = [];
      for (const teacherId of teachers) {
        await teacherDepartmentsCollection.insertOne({
          teacher_id: new ObjectId(teacherId),
          department_id: insertResult.insertedId
        });
        const teacherInfo = await usersCollection.findOne(
          { _id: new ObjectId(teacherId) },
          { projection: { full_name: 1, account_number: 1 } }
        );
        if (teacherInfo) {
          assignedTeachers.push({
            id: teacherInfo._id.toString(),
            full_name: teacherInfo.full_name,
            account_number: teacherInfo.account_number
          });
        }
      }
      if (assignedTeachers.length > 0) {
        try {
          const activityCollection = db.collection("activity_logs");
          await activityCollection.insertOne({
            activity_type: "department_teacher_assigned",
            user_id: user?.id ? new ObjectId(user.id) : null,
            user_account_number: user?.accountNumber || null,
            activity_data: {
              department_id: insertResult.insertedId.toString(),
              department_name: name,
              department_code: code.toUpperCase(),
              teachers: assignedTeachers
            },
            ip_address: getClientAddress(),
            user_agent: request.headers.get("user-agent"),
            created_at: /* @__PURE__ */ new Date()
          });
        } catch (logError) {
          console.error("Error logging teacher assignment activity:", logError);
        }
      }
    }
    try {
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "department_created",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          department_id: insertResult.insertedId.toString(),
          department_name: name,
          department_code: code.toUpperCase()
        },
        ip_address: getClientAddress(),
        user_agent: request.headers.get("user-agent"),
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging department creation activity:", logError);
    }
    return json({
      success: true,
      message: "Department created successfully",
      data: {
        ...newDepartment,
        subjects: [],
        teachers: [],
        subject_count: 0,
        teacher_count: teachers.length
      }
    });
  } catch (error) {
    console.error("Error creating department:", error);
    if (error.code === 11e3) {
      return json({ success: false, error: "Department name or code already exists" }, { status: 400 });
    }
    return json({ success: false, error: "Failed to create department" }, { status: 500 });
  }
}
async function PUT({ request, getClientAddress }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const requestBody = await request.json();
    const { id, name, code, teachers = [], subjects = [] } = requestBody;
    if (!id || !name || !code) {
      return json({ success: false, error: "Department ID, name and code are required" }, { status: 400 });
    }
    if (code.length > 20) {
      return json({ success: false, error: "Department code cannot exceed 20 characters" }, { status: 400 });
    }
    if (name.length > 100) {
      return json({ success: false, error: "Department name cannot exceed 100 characters" }, { status: 400 });
    }
    await client.connect();
    const db = client.db("set-2-system");
    const departmentsCollection = db.collection("departments");
    const teacherDepartmentsCollection = db.collection("teacher_departments");
    const subjectsCollection = db.collection("subjects");
    const usersCollection = db.collection("users");
    const currentDept = await departmentsCollection.findOne(
      { _id: new ObjectId(id), status: "active" },
      { projection: { name: 1, code: 1 } }
    );
    if (!currentDept) {
      return json({ success: false, error: "Department not found" }, { status: 404 });
    }
    const nameChanged = currentDept.name !== name;
    const codeChanged = currentDept.code !== code.toUpperCase();
    const basicInfoChanged = nameChanged || codeChanged;
    if (basicInfoChanged) {
      const existingDept = await departmentsCollection.findOne({
        _id: { $ne: new ObjectId(id) },
        $or: [
          { name },
          { code: code.toUpperCase() }
        ]
      });
      if (existingDept) {
        return json({ success: false, error: "Department name or code already exists" }, { status: 400 });
      }
    }
    const updateResult = await departmentsCollection.updateOne(
      { _id: new ObjectId(id), status: "active" },
      {
        $set: {
          name,
          code: code.toUpperCase(),
          updated_at: /* @__PURE__ */ new Date()
        }
      }
    );
    if (updateResult.matchedCount === 0) {
      return json({ success: false, error: "Department not found" }, { status: 404 });
    }
    const currentTeachersResult = await teacherDepartmentsCollection.aggregate([
      {
        $match: { department_id: new ObjectId(id) }
      },
      {
        $lookup: {
          from: "users",
          localField: "teacher_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: "$user"
      },
      {
        $project: {
          id: { $toString: "$user._id" },
          full_name: "$user.full_name",
          account_number: "$user.account_number"
        }
      }
    ]).toArray();
    const currentTeacherIds = new Set(currentTeachersResult.map((t) => t.id));
    const newTeacherIds = new Set(teachers);
    const removedTeachers = currentTeachersResult.filter((t) => !newTeacherIds.has(t.id));
    const addedTeacherIds = teachers.filter((id2) => !currentTeacherIds.has(id2));
    const teachersChanged = removedTeachers.length > 0 || addedTeacherIds.length > 0;
    if (teachersChanged) {
      await teacherDepartmentsCollection.deleteMany({ department_id: new ObjectId(id) });
      if (removedTeachers.length > 0) {
        try {
          const activityCollection = db.collection("activity_logs");
          await activityCollection.insertOne({
            activity_type: "department_teacher_removed",
            user_id: user?.id ? new ObjectId(user.id) : null,
            user_account_number: user?.accountNumber || null,
            activity_data: {
              department_id: id,
              department_name: name,
              department_code: code.toUpperCase(),
              teachers: removedTeachers
            },
            ip_address: getClientAddress(),
            user_agent: request.headers.get("user-agent"),
            created_at: /* @__PURE__ */ new Date()
          });
        } catch (logError) {
          console.error("Error logging teacher removal activity:", logError);
        }
      }
      if (teachers.length > 0) {
        const newTeachers = [];
        const teacherAssignments = [];
        for (const teacherId of teachers) {
          teacherAssignments.push({
            teacher_id: new ObjectId(teacherId),
            department_id: new ObjectId(id)
          });
          const teacherInfo = await usersCollection.findOne(
            { _id: new ObjectId(teacherId) },
            { projection: { full_name: 1, account_number: 1 } }
          );
          if (teacherInfo) {
            newTeachers.push({
              id: teacherInfo._id.toString(),
              full_name: teacherInfo.full_name,
              account_number: teacherInfo.account_number
            });
          }
        }
        if (teacherAssignments.length > 0) {
          await teacherDepartmentsCollection.insertMany(teacherAssignments);
        }
        const addedTeachers = newTeachers.filter((t) => addedTeacherIds.includes(t.id));
        if (addedTeachers.length > 0) {
          try {
            const activityCollection = db.collection("activity_logs");
            await activityCollection.insertOne({
              activity_type: "department_teacher_assigned",
              user_id: user?.id ? new ObjectId(user.id) : null,
              user_account_number: user?.accountNumber || null,
              activity_data: {
                department_id: id,
                department_name: name,
                department_code: code.toUpperCase(),
                teachers: addedTeachers
              },
              ip_address: getClientAddress(),
              user_agent: request.headers.get("user-agent"),
              created_at: /* @__PURE__ */ new Date()
            });
          } catch (logError) {
            console.error("Error logging teacher assignment activity:", logError);
          }
        }
      }
    }
    const currentSubjects = await subjectsCollection.find(
      { department_id: new ObjectId(id) },
      { projection: { name: 1, code: 1 } }
    ).toArray();
    const currentSubjectIds = new Set(currentSubjects.map((s) => s._id.toString()));
    const newSubjectIds = new Set(subjects);
    const removedSubjects = currentSubjects.filter((s) => !newSubjectIds.has(s._id.toString()));
    const addedSubjectIds = subjects.filter((id2) => !currentSubjectIds.has(id2));
    const subjectsChanged = removedSubjects.length > 0 || addedSubjectIds.length > 0;
    if (subjectsChanged) {
      await subjectsCollection.updateMany(
        { department_id: new ObjectId(id) },
        { $unset: { department_id: "" } }
      );
      if (removedSubjects.length > 0) {
        const removedSubjectsForLog = removedSubjects.map((subject) => ({
          id: subject._id.toString(),
          name: subject.name,
          code: subject.code
        }));
        try {
          const activityCollection = db.collection("activity_logs");
          await activityCollection.insertOne({
            activity_type: "department_subject_removed",
            user_id: user?.id ? new ObjectId(user.id) : null,
            user_account_number: user?.accountNumber || null,
            activity_data: {
              department_id: id,
              department_name: name,
              department_code: code.toUpperCase(),
              subjects: removedSubjectsForLog
            },
            ip_address: getClientAddress(),
            user_agent: request.headers.get("user-agent"),
            created_at: /* @__PURE__ */ new Date()
          });
        } catch (logError) {
          console.error("Error logging subject removal activity:", logError);
        }
      }
      if (subjects.length > 0) {
        const subjectIds = subjects.map((subjectId) => new ObjectId(subjectId));
        await subjectsCollection.updateMany(
          { _id: { $in: subjectIds } },
          { $set: { department_id: new ObjectId(id) } }
        );
        if (addedSubjectIds.length > 0) {
          const addedSubjectObjectIds = addedSubjectIds.map((id2) => new ObjectId(id2));
          const addedSubjectInfos = await subjectsCollection.find(
            { _id: { $in: addedSubjectObjectIds } },
            { projection: { name: 1, code: 1 } }
          ).toArray();
          const addedSubjectsForLog = addedSubjectInfos.map((subject) => ({
            id: subject._id.toString(),
            name: subject.name,
            code: subject.code
          }));
          if (addedSubjectsForLog.length > 0) {
            try {
              const activityCollection = db.collection("activity_logs");
              await activityCollection.insertOne({
                activity_type: "department_subject_assigned",
                user_id: user?.id ? new ObjectId(user.id) : null,
                user_account_number: user?.accountNumber || null,
                activity_data: {
                  department_id: id,
                  department_name: name,
                  department_code: code.toUpperCase(),
                  subjects: addedSubjectsForLog
                },
                ip_address: getClientAddress(),
                user_agent: request.headers.get("user-agent"),
                created_at: /* @__PURE__ */ new Date()
              });
            } catch (logError) {
              console.error("Error logging subject assignment activity:", logError);
            }
          }
        }
      }
    }
    if (basicInfoChanged) {
      try {
        const activityCollection = db.collection("activity_logs");
        await activityCollection.insertOne({
          activity_type: "department_updated",
          user_id: user?.id ? new ObjectId(user.id) : null,
          user_account_number: user?.accountNumber || null,
          activity_data: {
            department_id: id,
            department_name: name,
            department_code: code.toUpperCase()
          },
          ip_address: getClientAddress(),
          user_agent: request.headers.get("user-agent"),
          created_at: /* @__PURE__ */ new Date()
        });
      } catch (logError) {
        console.error("Error logging department update activity:", logError);
      }
    }
    const updatedDepartment = await departmentsCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { name: 1, code: 1, status: 1, created_at: 1, updated_at: 1 } }
    );
    return json({
      success: true,
      message: "Department updated successfully",
      data: {
        id: updatedDepartment._id.toString(),
        name: updatedDepartment.name,
        code: updatedDepartment.code,
        status: updatedDepartment.status,
        created_at: updatedDepartment.created_at,
        updated_at: updatedDepartment.updated_at
      }
    });
  } catch (error) {
    console.error("Error updating department:", error);
    if (error.code === 11e3) {
      return json({ success: false, error: "Department name or code already exists" }, { status: 400 });
    }
    return json({ success: false, error: "Failed to update department" }, { status: 500 });
  }
}
async function DELETE({ request, getClientAddress }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await request.json();
    if (!id) {
      return json({ success: false, error: "Department ID is required" }, { status: 400 });
    }
    await client.connect();
    const db = client.db("set-2-system");
    const departmentsCollection = db.collection("departments");
    const teacherDepartmentsCollection = db.collection("teacher_departments");
    const subjectsCollection = db.collection("subjects");
    const department = await departmentsCollection.findOne(
      { _id: new ObjectId(id), status: "active" },
      { projection: { name: 1, code: 1 } }
    );
    if (!department) {
      return json({ success: false, error: "Department not found" }, { status: 404 });
    }
    const subjectsResult = await subjectsCollection.find(
      { department_id: new ObjectId(id) },
      { projection: { _id: 1 } }
    ).toArray();
    if (subjectsResult.length > 0) {
      await subjectsCollection.updateMany(
        { department_id: new ObjectId(id) },
        { $unset: { department_id: "" } }
      );
    }
    await teacherDepartmentsCollection.deleteMany({ department_id: new ObjectId(id) });
    const deleteResult = await departmentsCollection.deleteOne({ _id: new ObjectId(id) });
    if (deleteResult.deletedCount === 0) {
      return json({ success: false, error: "Department not found" }, { status: 404 });
    }
    try {
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "department_deleted",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.accountNumber || null,
        activity_data: {
          department_id: id,
          department_name: department.name,
          department_code: department.code
        },
        ip_address: getClientAddress(),
        user_agent: request.headers.get("user-agent"),
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging department deletion activity:", logError);
    }
    return json({
      success: true,
      message: "Department deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    return json({ success: false, error: "Failed to delete department" }, { status: 500 });
  }
}

export { DELETE, GET, POST, PUT };
//# sourceMappingURL=_server-BpRmuXtP.js.map
