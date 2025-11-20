import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { v as verifyAuth } from './auth-helper-DY2o5dhz.js';
import { ObjectId } from 'mongodb';
import 'dotenv';

async function GET({ url, request }) {
  try {
    const authResult = await verifyAuth(request, ["admin", "teacher", "adviser"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const db = await connectToDatabase();
    const action = url.searchParams.get("action");
    const gradeLevel = url.searchParams.get("gradeLevel");
    const schoolYearSetting = await db.collection("admin_settings").findOne({
      setting_key: "current_school_year"
    });
    const schoolYear = url.searchParams.get("schoolYear") || schoolYearSetting?.setting_value || "2025-2026";
    const sectionId = url.searchParams.get("sectionId");
    switch (action) {
      case "available-sections":
        const sections = await db.collection("sections").find({
          status: "active"
        }).sort({ grade_level: 1, name: 1 }).toArray();
        return json({ success: true, data: sections });
      case "available-rooms":
        const rooms = await db.collection("rooms").aggregate([
          {
            $lookup: {
              from: "sections",
              localField: "_id",
              foreignField: "room_id",
              as: "assigned_sections",
              pipeline: [{ $match: { status: "active" } }]
            }
          },
          {
            $addFields: {
              available: { $eq: [{ $size: "$assigned_sections" }, 0] }
            }
          },
          {
            $project: {
              id: "$_id",
              name: 1,
              building: 1,
              floor: 1,
              status: 1,
              available: 1
            }
          },
          {
            $sort: { building: 1, floor: 1, name: 1 }
          }
        ]).toArray();
        return json({ success: true, data: rooms });
      case "available-teachers":
        const teacherGradeLevel = url.searchParams.get("teacherGradeLevel");
        const availableTeachers = await db.collection("users").aggregate([
          {
            $match: {
              account_type: "teacher",
              status: "active"
            }
          },
          {
            $lookup: {
              from: "sections",
              localField: "_id",
              foreignField: "adviser_id",
              as: "advised_sections",
              pipeline: [
                {
                  $match: {
                    status: "active",
                    school_year: schoolYear,
                    ...teacherGradeLevel && { grade_level: parseInt(teacherGradeLevel) }
                  }
                }
              ]
            }
          },
          {
            $match: {
              advised_sections: { $size: 0 }
            }
          },
          {
            $project: {
              id: "$_id",
              account_number: 1,
              first_name: 1,
              last_name: 1,
              full_name: 1,
              email: 1
            }
          }
        ]).toArray();
        return json({ success: true, data: availableTeachers });
      case "available-students":
        if (!gradeLevel) {
          return json({ success: false, error: "Grade level is required" }, { status: 400 });
        }
        const availableStudents = await db.collection("users").aggregate([
          {
            $match: {
              account_type: "student",
              status: "active",
              grade_level: gradeLevel.toString()
            }
          },
          {
            $lookup: {
              from: "section_students",
              localField: "_id",
              foreignField: "student_id",
              as: "enrollments",
              pipeline: [
                {
                  $lookup: {
                    from: "sections",
                    localField: "section_id",
                    foreignField: "_id",
                    as: "section"
                  }
                },
                {
                  $match: {
                    status: "active",
                    "section.status": "active",
                    "section.school_year": schoolYear
                  }
                }
              ]
            }
          },
          {
            $match: {
              enrollments: { $size: 0 }
            }
          },
          {
            $project: {
              id: "$_id",
              account_number: 1,
              first_name: 1,
              last_name: 1,
              full_name: 1,
              email: 1,
              grade_level: 1,
              age: 1,
              guardian: 1
            }
          }
        ]).toArray();
        return json({ success: true, data: availableStudents });
      case "section-details":
        if (!sectionId) {
          return json({ success: false, error: "Section ID is required" }, { status: 400 });
        }
        const sectionDetails = await db.collection("sections").aggregate([
          {
            $match: { _id: new ObjectId(sectionId) }
          },
          {
            $lookup: {
              from: "users",
              localField: "adviser_id",
              foreignField: "_id",
              as: "adviser"
            }
          },
          {
            $lookup: {
              from: "rooms",
              localField: "room_id",
              foreignField: "_id",
              as: "room"
            }
          },
          {
            $lookup: {
              from: "section_students",
              localField: "_id",
              foreignField: "section_id",
              as: "students",
              pipeline: [
                { $match: { status: "active" } },
                {
                  $lookup: {
                    from: "users",
                    localField: "student_id",
                    foreignField: "_id",
                    as: "student_info"
                  }
                },
                { $unwind: "$student_info" }
              ]
            }
          },
          {
            $addFields: {
              id: "$_id",
              adviser_name: { $arrayElemAt: ["$adviser.full_name", 0] },
              room_name: { $arrayElemAt: ["$room.name", 0] },
              student_count: { $size: "$students" }
            }
          }
        ]).toArray();
        return json({ success: true, data: sectionDetails[0] || null });
      case "section-students":
        if (!sectionId) {
          return json({ success: false, error: "Section ID is required" }, { status: 400 });
        }
        const sectionStudents = await db.collection("section_students").aggregate([
          {
            $match: {
              section_id: new ObjectId(sectionId),
              status: "active"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "student_id",
              foreignField: "_id",
              as: "student"
            }
          },
          {
            $unwind: "$student"
          },
          {
            $project: {
              id: "$student._id",
              account_number: "$student.account_number",
              first_name: "$student.first_name",
              last_name: "$student.last_name",
              full_name: "$student.full_name",
              email: "$student.email",
              grade_level: "$student.grade_level",
              age: "$student.age",
              guardian: "$student.guardian",
              enrolled_at: "$enrolled_at",
              enrollment_status: "$status"
            }
          },
          {
            $sort: { full_name: 1 }
          }
        ]).toArray();
        return json({ success: true, data: sectionStudents });
      default:
        const searchTerm = url.searchParams.get("search");
        let pipeline = [
          {
            $match: {
              school_year: schoolYear,
              status: "active"
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "adviser_id",
              foreignField: "_id",
              as: "adviser"
            }
          },
          {
            $lookup: {
              from: "rooms",
              localField: "room_id",
              foreignField: "_id",
              as: "room"
            }
          },
          {
            $lookup: {
              from: "section_students",
              localField: "_id",
              foreignField: "section_id",
              as: "students",
              pipeline: [
                { $match: { status: "active" } },
                {
                  $lookup: {
                    from: "users",
                    localField: "student_id",
                    foreignField: "_id",
                    as: "student_info"
                  }
                },
                { $unwind: "$student_info" }
              ]
            }
          },
          {
            $addFields: {
              id: "$_id",
              adviser_name: { $arrayElemAt: ["$adviser.full_name", 0] },
              adviser_account_number: { $arrayElemAt: ["$adviser.account_number", 0] },
              room_name: { $arrayElemAt: ["$room.name", 0] },
              room_building: { $arrayElemAt: ["$room.building", 0] },
              room_floor: { $arrayElemAt: ["$room.floor", 0] },
              student_count: { $size: "$students" }
            }
          }
        ];
        if (searchTerm && searchTerm.trim()) {
          const searchRegex = { $regex: searchTerm.trim(), $options: "i" };
          pipeline.push({
            $match: {
              $or: [
                // Search by section name
                { name: searchRegex },
                // Search by grade level (as string)
                { grade_level: { $regex: searchTerm.trim(), $options: "i" } },
                // Search by adviser name
                { adviser_name: searchRegex },
                // Search by student account number or name
                {
                  "students.student_info.account_number": searchRegex
                },
                {
                  "students.student_info.full_name": searchRegex
                },
                {
                  "students.student_info.first_name": searchRegex
                },
                {
                  "students.student_info.last_name": searchRegex
                }
              ]
            }
          });
        }
        pipeline.push({
          $sort: { grade_level: 1, name: 1 }
        });
        const allSections = await db.collection("sections").aggregate(pipeline).toArray();
        return json({ success: true, data: allSections });
    }
  } catch (error) {
    console.error("Error fetching sections data:", error);
    return json({ success: false, error: "Failed to fetch data" }, { status: 500 });
  }
}
async function POST({ request, getClientAddress }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const user2 = authResult.user;
    const db = await connectToDatabase();
    const requestBody = await request.json();
    const {
      sectionName,
      gradeLevel,
      schoolYear,
      adviserId: adviserId_raw,
      studentIds,
      roomId
    } = requestBody;
    const adviserId = adviserId_raw || requestBody.adviser_id;
    const clientIP = getClientAddress();
    const userAgent = request.headers.get("user-agent");
    if (!sectionName || !gradeLevel || !schoolYear) {
      return json({ success: false, error: "Missing required fields" }, { status: 400 });
    }
    const existingSection = await db.collection("sections").findOne({
      name: sectionName,
      grade_level: parseInt(gradeLevel),
      school_year: schoolYear,
      status: "active"
    });
    if (existingSection) {
      return json({
        success: false,
        error: "A section with this name already exists for the specified grade level and school year"
      }, { status: 400 });
    }
    if (adviserId) {
      const adviser = await db.collection("users").findOne({
        _id: new ObjectId(adviserId),
        account_type: "teacher",
        status: "active"
      });
      if (!adviser) {
        return json({
          success: false,
          error: "Invalid adviser selected"
        }, { status: 400 });
      }
      const existingAdviserSection = await db.collection("sections").findOne({
        adviser_id: new ObjectId(adviserId),
        school_year: schoolYear,
        status: "active"
      });
      if (existingAdviserSection) {
        return json({
          success: false,
          error: "This teacher is already assigned as an adviser to another section"
        }, { status: 400 });
      }
    }
    if (roomId) {
      const room = await db.collection("rooms").findOne({
        _id: new ObjectId(roomId),
        status: "active"
      });
      if (!room) {
        return json({
          success: false,
          error: "Invalid room selected"
        }, { status: 400 });
      }
      const existingRoomSection = await db.collection("sections").findOne({
        room_id: new ObjectId(roomId),
        status: "active"
      });
      if (existingRoomSection) {
        return json({
          success: false,
          error: "This room is already assigned to another section"
        }, { status: 400 });
      }
    }
    const sectionData = {
      name: sectionName,
      grade_level: parseInt(gradeLevel),
      school_year: schoolYear,
      status: "active",
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date()
    };
    if (adviserId) {
      sectionData.adviser_id = new ObjectId(adviserId);
    }
    if (roomId) {
      sectionData.room_id = new ObjectId(roomId);
    }
    const sectionResult = await db.collection("sections").insertOne(sectionData);
    const newSectionId = sectionResult.insertedId;
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      const students = await db.collection("users").find({
        _id: { $in: studentIds.map((id) => new ObjectId(id)) },
        account_type: "student",
        status: "active",
        grade_level: gradeLevel.toString()
      }).toArray();
      if (students.length !== studentIds.length) {
        return json({
          success: false,
          error: "Some selected students are invalid or not available"
        }, { status: 400 });
      }
      const existingEnrollments = await db.collection("section_students").find({
        student_id: { $in: studentIds.map((id) => new ObjectId(id)) },
        status: "active"
      }).toArray();
      if (existingEnrollments.length > 0) {
        return json({
          success: false,
          error: "Some students are already enrolled in other sections"
        }, { status: 400 });
      }
      const enrollmentData = studentIds.map((studentId) => ({
        section_id: newSectionId,
        student_id: new ObjectId(studentId),
        enrolled_at: /* @__PURE__ */ new Date(),
        status: "active"
      }));
      await db.collection("section_students").insertMany(enrollmentData);
    }
    try {
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "section_created",
        user_id: user2?.id ? new ObjectId(user2.id) : null,
        user_account_number: user2?.account_number || null,
        activity_data: {
          section_name: sectionName,
          grade_level: parseInt(gradeLevel),
          school_year: schoolYear,
          student_count: studentIds ? studentIds.length : 0
        },
        ip_address: clientIP,
        user_agent: userAgent,
        created_at: /* @__PURE__ */ new Date()
      });
      if (adviserId) {
        const adviser = await db.collection("users").findOne({
          _id: new ObjectId(adviserId)
        });
        if (adviser) {
          await activityCollection.insertOne({
            activity_type: "adviser_assigned_to_section",
            user_id: user2?.id ? new ObjectId(user2.id) : null,
            user_account_number: user2?.account_number || null,
            activity_data: {
              section_name: sectionName,
              grade_level: parseInt(gradeLevel),
              adviser: {
                name: adviser.full_name,
                account_number: adviser.account_number
              }
            },
            ip_address: clientIP,
            user_agent: userAgent,
            created_at: /* @__PURE__ */ new Date()
          });
        }
      }
      if (studentIds && studentIds.length > 0) {
        for (const studentId of studentIds) {
          const student = await db.collection("users").findOne({ _id: new ObjectId(studentId) });
          await activityCollection.insertOne({
            activity_type: "student_enrolled_to_section",
            user_id: user2?.id ? new ObjectId(user2.id) : null,
            user_account_number: user2?.account_number || null,
            activity_data: {
              section_name: sectionName,
              student: {
                name: student?.full_name,
                account_number: student?.account_number
              }
            },
            ip_address: clientIP,
            user_agent: userAgent,
            created_at: /* @__PURE__ */ new Date()
          });
        }
      }
    } catch (logError) {
      console.error("Error logging section creation activity:", logError);
    }
    const sectionDetails = await db.collection("sections").aggregate([
      {
        $match: { _id: newSectionId }
      },
      {
        $lookup: {
          from: "users",
          localField: "adviser_id",
          foreignField: "_id",
          as: "adviser"
        }
      },
      {
        $lookup: {
          from: "rooms",
          localField: "room_id",
          foreignField: "_id",
          as: "room"
        }
      },
      {
        $lookup: {
          from: "section_students",
          localField: "_id",
          foreignField: "section_id",
          as: "students",
          pipeline: [{ $match: { status: "active" } }]
        }
      },
      {
        $addFields: {
          id: "$_id",
          adviser_name: { $arrayElemAt: ["$adviser.full_name", 0] },
          room_name: { $arrayElemAt: ["$room.name", 0] },
          student_count: { $size: "$students" }
        }
      }
    ]).toArray();
    return json({
      success: true,
      data: sectionDetails[0],
      message: `Section ${sectionName} created successfully with ${studentIds ? studentIds.length : 0} students`
    });
  } catch (error) {
    console.error("Error creating section:", error);
    return json({ success: false, error: "Failed to create section" }, { status: 500 });
  }
}
async function PUT({ request, getClientAddress }) {
  console.log("=== PUT REQUEST STARTED ===");
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const user2 = authResult.user;
    const db = await connectToDatabase();
    console.log("Database connected successfully");
    const requestBody = await request.json();
    console.log("Request body:", JSON.stringify(requestBody, null, 2));
    const sectionId = requestBody.sectionId || requestBody.section_id;
    const updates = requestBody.updates || {
      name: requestBody.sectionName,
      adviserId: requestBody.adviserId,
      studentIds: requestBody.studentIds,
      roomId: requestBody.roomId
    };
    console.log("Parsed sectionId:", sectionId);
    console.log("Parsed updates:", JSON.stringify(updates, null, 2));
    const clientIP = getClientAddress();
    const userAgent = request.headers.get("user-agent");
    if (!sectionId) {
      console.log("Section ID missing - returning 400");
      return json({ success: false, error: "Section ID is required" }, { status: 400 });
    }
    console.log("Starting database operations...");
    const currentSection = await db.collection("sections").findOne({
      _id: new ObjectId(sectionId),
      status: "active"
    });
    console.log("Current section found:", currentSection ? "YES" : "NO");
    console.log("Current section data:", currentSection);
    if (!currentSection) {
      return json({ success: false, error: "Section not found" }, { status: 404 });
    }
    const updateData = {
      $set: { updated_at: /* @__PURE__ */ new Date() }
    };
    const changes = [];
    if (updates.name && updates.name !== currentSection.name) {
      const existingSection = await db.collection("sections").findOne({
        name: updates.name,
        grade_level: currentSection.grade_level,
        school_year: currentSection.school_year,
        status: "active",
        _id: { $ne: new ObjectId(sectionId) }
      });
      if (existingSection) {
        return json({
          success: false,
          error: "A section with this name already exists for the same grade level and school year"
        }, { status: 400 });
      }
      updateData.$set.name = updates.name;
      changes.push(`Name changed from "${currentSection.name}" to "${updates.name}"`);
    }
    let adviserChangeLog = null;
    if (updates.adviserId !== void 0) {
      if (updates.adviserId && updates.adviserId !== currentSection.adviser_id?.toString()) {
        const adviser = await db.collection("users").findOne({
          _id: new ObjectId(updates.adviserId),
          account_type: "teacher",
          status: "active"
        });
        if (!adviser) {
          return json({
            success: false,
            error: "Invalid adviser selected"
          }, { status: 400 });
        }
        const existingAdviserSection = await db.collection("sections").findOne({
          adviser_id: new ObjectId(updates.adviserId),
          school_year: currentSection.school_year,
          status: "active",
          _id: { $ne: new ObjectId(sectionId) }
        });
        if (existingAdviserSection) {
          return json({
            success: false,
            error: "This teacher is already assigned as an adviser to another section"
          }, { status: 400 });
        }
        updateData.$set.adviser_id = new ObjectId(updates.adviserId);
        changes.push(`Adviser assigned: ${adviser.full_name}`);
        adviserChangeLog = {
          type: currentSection.adviser_id ? "adviser_changed" : "adviser_assigned",
          newAdviser: {
            name: adviser.full_name,
            account_number: adviser.account_number
          },
          oldAdviser: null
        };
        if (currentSection.adviser_id) {
          const oldAdviser = await db.collection("users").findOne({
            _id: currentSection.adviser_id
          });
          if (oldAdviser) {
            adviserChangeLog.oldAdviser = {
              name: oldAdviser.full_name,
              account_number: oldAdviser.account_number
            };
          }
        }
      } else if (!updates.adviserId && currentSection.adviser_id) {
        const oldAdviser = await db.collection("users").findOne({
          _id: currentSection.adviser_id
        });
        updateData.$unset = { adviser_id: "" };
        changes.push("Adviser removed");
        if (oldAdviser) {
          adviserChangeLog = {
            type: "adviser_removed",
            oldAdviser: {
              name: oldAdviser.full_name,
              account_number: oldAdviser.account_number
            }
          };
        }
      }
    }
    if (updates.roomId !== void 0) {
      if (updates.roomId && updates.roomId !== currentSection.room_id?.toString()) {
        const room = await db.collection("rooms").findOne({
          _id: new ObjectId(updates.roomId),
          status: "active"
        });
        if (!room) {
          return json({
            success: false,
            error: "Invalid room selected"
          }, { status: 400 });
        }
        const existingRoomSection = await db.collection("sections").findOne({
          room_id: new ObjectId(updates.roomId),
          status: "active",
          _id: { $ne: new ObjectId(sectionId) }
        });
        if (existingRoomSection) {
          return json({
            success: false,
            error: "This room is already assigned to another section"
          }, { status: 400 });
        }
        updateData.$set.room_id = new ObjectId(updates.roomId);
        changes.push(`Room assigned: ${room.name}`);
      } else if (!updates.roomId && currentSection.room_id) {
        if (!updateData.$unset) updateData.$unset = {};
        updateData.$unset.room_id = "";
        changes.push("Room removed");
      }
    }
    if (updates.studentIds !== void 0) {
      const newStudentIds = updates.studentIds || [];
      const currentStudents = await db.collection("section_students").find({
        section_id: new ObjectId(sectionId),
        status: "active"
      }).toArray();
      const currentStudentIds = currentStudents.map((s) => s.student_id.toString());
      const newStudentIdStrings = newStudentIds.map((id) => id.toString());
      const studentsToAdd = newStudentIds.filter((id) => !currentStudentIds.includes(id.toString()));
      const studentsToRemove = currentStudentIds.filter((id) => !newStudentIdStrings.includes(id));
      if (studentsToAdd.length > 0) {
        const validStudentIds = studentsToAdd.filter((id) => {
          try {
            return id && ObjectId.isValid(id);
          } catch (e) {
            return false;
          }
        });
        if (validStudentIds.length === 0) {
          return json({
            success: false,
            error: "No valid student IDs provided"
          }, { status: 400 });
        }
        const students = await db.collection("users").find({
          _id: { $in: validStudentIds.map((id) => new ObjectId(id)) },
          account_type: "student",
          status: "active",
          grade_level: currentSection.grade_level.toString()
        }).toArray();
        if (students.length !== validStudentIds.length) {
          return json({
            success: false,
            error: "Some selected students are invalid or not available"
          }, { status: 400 });
        }
        const existingEnrollments = await db.collection("section_students").find({
          student_id: { $in: validStudentIds.map((id) => new ObjectId(id)) },
          status: "active"
        }).toArray();
        if (existingEnrollments.length > 0) {
          return json({
            success: false,
            error: "Some students are already enrolled in other sections"
          }, { status: 400 });
        }
        const enrollmentData = validStudentIds.map((studentId) => ({
          section_id: new ObjectId(sectionId),
          student_id: new ObjectId(studentId),
          enrolled_at: /* @__PURE__ */ new Date(),
          status: "active"
        }));
        await db.collection("section_students").insertMany(enrollmentData);
        changes.push(`Added ${validStudentIds.length} students`);
        const activityCollection = db.collection("activity_logs");
        for (const student of students) {
          await activityCollection.insertOne({
            activity_type: "student_added_to_section",
            user_id: user2?.id ? new ObjectId(user2.id) : null,
            user_account_number: user2?.account_number || null,
            activity_data: {
              section_name: currentSection.name,
              student: {
                name: student.full_name,
                account_number: student.account_number
              }
            },
            ip_address: clientIP,
            user_agent: userAgent,
            created_at: /* @__PURE__ */ new Date()
          });
        }
      }
      if (studentsToRemove.length > 0) {
        const validRemoveIds = studentsToRemove.filter((id) => {
          try {
            return id && ObjectId.isValid(id);
          } catch (e) {
            return false;
          }
        });
        if (validRemoveIds.length > 0) {
          await db.collection("section_students").updateMany(
            {
              section_id: new ObjectId(sectionId),
              student_id: { $in: validRemoveIds.map((id) => new ObjectId(id)) },
              status: "active"
            },
            {
              $set: {
                status: "inactive",
                removed_at: /* @__PURE__ */ new Date()
              }
            }
          );
          changes.push(`Removed ${validRemoveIds.length} students`);
          const removedStudents = await db.collection("users").find({
            _id: { $in: validRemoveIds.map((id) => new ObjectId(id)) }
          }).toArray();
          const activityCollection = db.collection("activity_logs");
          for (const student of removedStudents) {
            await activityCollection.insertOne({
              activity_type: "student_removed_from_section",
              user_id: user2?.id ? new ObjectId(user2.id) : null,
              user_account_number: user2?.account_number || null,
              activity_data: {
                section_name: currentSection.name,
                student: {
                  name: student.full_name,
                  account_number: student.account_number
                }
              },
              ip_address: clientIP,
              user_agent: userAgent,
              created_at: /* @__PURE__ */ new Date()
            });
          }
        }
      }
    }
    if (Object.keys(updateData.$set).length > 1 || updateData.$unset) {
      console.log("Updating section with data:", JSON.stringify(updateData, null, 2));
      await db.collection("sections").updateOne(
        { _id: new ObjectId(sectionId) },
        updateData
      );
    }
    if (adviserChangeLog) {
      const activityCollection = db.collection("activity_logs");
      if (adviserChangeLog.type === "adviser_assigned") {
        await activityCollection.insertOne({
          activity_type: "adviser_assigned_to_section",
          user_id: user2?.id ? new ObjectId(user2.id) : null,
          user_account_number: user2?.account_number || null,
          activity_data: {
            section_name: currentSection.name,
            grade_level: currentSection.grade_level,
            adviser: adviserChangeLog.newAdviser
          },
          ip_address: clientIP,
          user_agent: userAgent,
          created_at: /* @__PURE__ */ new Date()
        });
      } else if (adviserChangeLog.type === "adviser_changed") {
        await activityCollection.insertOne({
          activity_type: "adviser_changed_in_section",
          user_id: user2?.id ? new ObjectId(user2.id) : null,
          user_account_number: user2?.account_number || null,
          activity_data: {
            section_name: currentSection.name,
            grade_level: currentSection.grade_level,
            old_adviser: adviserChangeLog.oldAdviser,
            new_adviser: adviserChangeLog.newAdviser
          },
          ip_address: clientIP,
          user_agent: userAgent,
          created_at: /* @__PURE__ */ new Date()
        });
      } else if (adviserChangeLog.type === "adviser_removed") {
        await activityCollection.insertOne({
          activity_type: "adviser_removed_from_section",
          user_id: user2?.id ? new ObjectId(user2.id) : null,
          user_account_number: user2?.account_number || null,
          activity_data: {
            section_name: currentSection.name,
            grade_level: currentSection.grade_level,
            adviser: adviserChangeLog.oldAdviser
          },
          ip_address: clientIP,
          user_agent: userAgent,
          created_at: /* @__PURE__ */ new Date()
        });
      }
    }
    const nonStudentAdviserChanges = changes.filter(
      (change) => !change.includes("Added") && !change.includes("Removed") && !change.includes("students") && !change.includes("Adviser")
    );
    if (nonStudentAdviserChanges.length > 0) {
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "section_updated",
        user_id: user2?.id ? new ObjectId(user2.id) : null,
        user_account_number: user2?.account_number || null,
        activity_data: {
          section_name: currentSection.name
        },
        ip_address: clientIP,
        user_agent: userAgent,
        created_at: /* @__PURE__ */ new Date()
      });
    }
    const updatedSection = await db.collection("sections").aggregate([
      {
        $match: { _id: new ObjectId(sectionId) }
      },
      {
        $lookup: {
          from: "users",
          localField: "adviser_id",
          foreignField: "_id",
          as: "adviser"
        }
      },
      {
        $lookup: {
          from: "rooms",
          localField: "room_id",
          foreignField: "_id",
          as: "room"
        }
      },
      {
        $lookup: {
          from: "section_students",
          localField: "_id",
          foreignField: "section_id",
          as: "students",
          pipeline: [{ $match: { status: "active" } }]
        }
      },
      {
        $addFields: {
          id: "$_id",
          adviser_name: { $arrayElemAt: ["$adviser.full_name", 0] },
          room_name: { $arrayElemAt: ["$room.name", 0] },
          student_count: { $size: "$students" }
        }
      }
    ]).toArray();
    return json({
      success: true,
      data: updatedSection[0],
      message: changes.length > 0 ? `Section updated: ${changes.join(", ")}` : "No changes made"
    });
  } catch (error) {
    console.error("Error updating section:", error);
    console.error("Error details:", error.message);
    console.error("Stack trace:", error.stack);
    return json({ success: false, error: "Failed to update section" }, { status: 500 });
  }
}
async function DELETE({ request, getClientAddress, url }) {
  try {
    const authResult = await verifyAuth(request, ["admin"]);
    if (!authResult.success) {
      return json({ error: authResult.error || "Authentication required" }, { status: 401 });
    }
    const db = await connectToDatabase();
    const sectionId = url.searchParams.get("sectionId");
    const clientIP = getClientAddress();
    const userAgent = request.headers.get("user-agent");
    if (!sectionId) {
      return json({ success: false, error: "Section ID is required" }, { status: 400 });
    }
    const section = await db.collection("sections").findOne({
      _id: new ObjectId(sectionId),
      status: "active"
    });
    if (!section) {
      return json({ success: false, error: "Section not found" }, { status: 404 });
    }
    const studentCount = await db.collection("section_students").countDocuments({
      section_id: new ObjectId(sectionId),
      status: "active"
    });
    if (section.room_id) {
      await db.collection("rooms").updateOne(
        { _id: section.room_id },
        {
          $set: {
            status: "available",
            updated_at: /* @__PURE__ */ new Date()
          },
          $unset: { assigned_to: "" }
        }
      );
    }
    await db.collection("section_students").updateMany(
      {
        section_id: new ObjectId(sectionId),
        status: "active"
      },
      {
        $set: {
          status: "inactive",
          removed_at: /* @__PURE__ */ new Date()
        }
      }
    );
    await db.collection("sections").updateOne(
      { _id: new ObjectId(sectionId) },
      {
        $set: {
          status: "inactive",
          deleted_at: /* @__PURE__ */ new Date()
        }
      }
    );
    try {
      const activityCollection = db.collection("activity_logs");
      await activityCollection.insertOne({
        activity_type: "section_deleted",
        user_id: user?.id ? new ObjectId(user.id) : null,
        user_account_number: user?.account_number || null,
        activity_data: {
          section_name: section.name,
          grade_level: section.grade_level,
          school_year: section.school_year,
          student_count: studentCount
        },
        ip_address: clientIP,
        user_agent: userAgent,
        created_at: /* @__PURE__ */ new Date()
      });
    } catch (logError) {
      console.error("Error logging section deletion activity:", logError);
    }
    return json({
      success: true,
      message: `Section ${section.name} has been deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting section:", error);
    console.error("Error details:", error.message);
    console.error("Stack trace:", error.stack);
    return json({ success: false, error: "Failed to delete section" }, { status: 500 });
  }
}

export { DELETE, GET, POST, PUT };
//# sourceMappingURL=_server-DEPjOk58.js.map
