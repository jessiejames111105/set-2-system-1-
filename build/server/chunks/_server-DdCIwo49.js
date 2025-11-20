import { j as json } from './index-CccDCyu_.js';
import dotenv from 'dotenv';
import { a as connectToDatabase } from './db-C-gxO138.js';
import { ObjectId } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();
const GEMINI_MODEL = "gemini-2.5-flash";
const config = {
  runtime: "nodejs18",
  maxDuration: 60
};
async function POST({ request }) {
  console.log("=== AI Grade Analysis Request Started ===");
  let db;
  let cacheKey;
  try {
    const { studentId, quarter, schoolYear, forceRefresh = false, previousQuarterInfo = null } = await request.json();
    console.log("Request params:", { studentId, quarter, schoolYear, forceRefresh, hasPreviousQuarter: !!previousQuarterInfo });
    if (!studentId) {
      return json({ error: "Missing student ID" }, { status: 400 });
    }
    db = await connectToDatabase();
    const student = await db.collection("users").findOne({ _id: new ObjectId(studentId) });
    if (!student) {
      return json({ error: "Student not found" }, { status: 404 });
    }
    cacheKey = {
      student_id: new ObjectId(studentId),
      quarter,
      school_year: schoolYear
    };
    if (!forceRefresh) {
      const cachedAnalysis = await db.collection("ai_grade_analysis_cache").findOne(cacheKey);
      const CACHE_DURATION_DAYS = 7;
      const now = /* @__PURE__ */ new Date();
      const cacheValid = cachedAnalysis && (now - new Date(cachedAnalysis.created_at)) / (1e3 * 60 * 60 * 24) < CACHE_DURATION_DAYS;
      if (cacheValid && cachedAnalysis.analysis) {
        const isValidJSON = typeof cachedAnalysis.analysis === "object" && cachedAnalysis.analysis.overallInsight;
        if (isValidJSON) {
          console.log("Serving cached AI analysis (JSON format)");
          return streamCachedAnalysis(cachedAnalysis.analysis);
        } else {
          console.log("Cached analysis is in old format, regenerating...");
        }
      }
    } else {
      console.log("Force refresh requested - bypassing cache");
    }
    const gradesQuery = {
      student_id: new ObjectId(studentId),
      verified: true
      // Only fetch verified grades
    };
    if (quarter) gradesQuery.quarter = quarter;
    if (schoolYear) gradesQuery.school_year = schoolYear;
    const studentGrades = await db.collection("grades").find(gradesQuery).toArray();
    if (studentGrades.length === 0) {
      return json({ error: "No grades found for this student" }, { status: 404 });
    }
    let previousQuarterGrades = null;
    if (previousQuarterInfo && previousQuarterInfo.quarter && previousQuarterInfo.schoolYear) {
      console.log(`Fetching previous quarter ${previousQuarterInfo.quarter} (${previousQuarterInfo.schoolYear}) for comparison...`);
      previousQuarterGrades = await db.collection("grades").find({
        student_id: new ObjectId(studentId),
        quarter: previousQuarterInfo.quarter,
        school_year: previousQuarterInfo.schoolYear,
        verified: true
      }).toArray();
      console.log(`Found ${previousQuarterGrades.length} verified grades for previous quarter`);
    }
    const gradeAnalysisData = await prepareGradeDataFromDB(db, student, studentGrades, previousQuarterGrades, previousQuarterInfo);
    const prompt = createAnalysisPrompt(gradeAnalysisData);
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 5e3,
        responseMimeType: "application/json"
        // Force JSON response
      }
    });
    console.log("Using Google Gemini model:", GEMINI_MODEL);
    console.log("Making request to Gemini API...");
    let fullAnalysis;
    try {
      const result = await model.generateContent(prompt);
      console.log("Gemini API response received");
      const response = result.response;
      fullAnalysis = response.text();
      console.log("Response text extracted, length:", fullAnalysis.length);
    } catch (geminiError) {
      console.error("Gemini API call failed:", geminiError);
      console.error("Error details:", {
        message: geminiError.message,
        name: geminiError.name,
        stack: geminiError.stack
      });
      throw new Error(`Gemini API error: ${geminiError.message}`);
    }
    let parsedAnalysis;
    try {
      let cleanedAnalysis = fullAnalysis.trim();
      if (cleanedAnalysis.startsWith("```json")) {
        cleanedAnalysis = cleanedAnalysis.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (cleanedAnalysis.startsWith("```")) {
        cleanedAnalysis = cleanedAnalysis.replace(/```\n?/g, "");
      }
      const firstBrace = cleanedAnalysis.indexOf("{");
      const lastBrace = cleanedAnalysis.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("No JSON object found in response");
      }
      cleanedAnalysis = cleanedAnalysis.substring(firstBrace, lastBrace + 1);
      parsedAnalysis = JSON.parse(cleanedAnalysis);
      if (!parsedAnalysis.overallInsight || !parsedAnalysis.performanceLevel) {
        throw new Error("Invalid JSON structure - missing required fields");
      }
    } catch (error) {
      console.error("Failed to parse AI response as JSON:", error);
      console.error("Gemini Model used:", GEMINI_MODEL);
      console.error("Raw response (first 500 chars):", fullAnalysis.substring(0, 500));
      throw new Error("Gemini returned invalid JSON format. Please try again.");
    }
    await saveAnalysisToCache(db, cacheKey, parsedAnalysis);
    const jsonString = JSON.stringify(parsedAnalysis);
    const stream = new ReadableStream({
      start(controller) {
        const chunkSize = 50;
        let position = 0;
        const interval = setInterval(() => {
          if (position >= jsonString.length) {
            clearInterval(interval);
            controller.close();
            return;
          }
          const chunk = jsonString.slice(position, position + chunkSize);
          controller.enqueue(new TextEncoder().encode(chunk));
          position += chunkSize;
        }, 15);
      }
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (error) {
    console.error("AI Grade Analysis Error:", error);
    console.error("Error stack:", error.stack);
    if (db && cacheKey) {
      try {
        console.log("⚠️ AI generation failed - attempting to retrieve cached analysis as fallback...");
        const cachedAnalysis = await db.collection("ai_grade_analysis_cache").findOne(cacheKey);
        if (cachedAnalysis && cachedAnalysis.analysis) {
          const isValidJSON = typeof cachedAnalysis.analysis === "object" && cachedAnalysis.analysis.overallInsight;
          if (isValidJSON) {
            const cacheAge = Math.floor((/* @__PURE__ */ new Date() - new Date(cachedAnalysis.created_at)) / (1e3 * 60 * 60 * 24));
            console.log(`✅ Serving cached analysis as fallback (${cacheAge} days old)`);
            return streamCachedAnalysis(cachedAnalysis.analysis);
          }
        }
        console.log("❌ No valid cached analysis found for fallback");
      } catch (fallbackError) {
        console.error("Failed to retrieve cached analysis as fallback:", fallbackError);
      }
    }
    return json({
      error: "Failed to generate AI analysis",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : void 0
    }, { status: 500 });
  }
}
async function saveAnalysisToCache(db, cacheKey, analysis) {
  try {
    await db.collection("ai_grade_analysis_cache").updateOne(
      cacheKey,
      {
        $set: {
          ...cacheKey,
          analysis,
          created_at: /* @__PURE__ */ new Date(),
          updated_at: /* @__PURE__ */ new Date()
        }
      },
      { upsert: true }
    );
    console.log("Analysis saved to cache");
  } catch (error) {
    console.error("Error saving analysis to cache:", error);
  }
}
function streamCachedAnalysis(analysis) {
  const jsonString = typeof analysis === "string" ? analysis : JSON.stringify(analysis);
  const stream = new ReadableStream({
    start(controller) {
      const chunkSize = 50;
      let position = 0;
      const interval = setInterval(() => {
        if (position >= jsonString.length) {
          clearInterval(interval);
          controller.close();
          return;
        }
        const chunk = jsonString.slice(position, position + chunkSize);
        controller.enqueue(new TextEncoder().encode(chunk));
        position += chunkSize;
      }, 15);
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Cache-Status": "HIT"
    }
  });
}
async function prepareGradeDataFromDB(db, student, studentGrades, previousQuarterGrades = null, previousQuarterInfo = null) {
  const section = student.section_id ? await db.collection("sections").findOne({ _id: new ObjectId(student.section_id) }) : null;
  const totalGrades = studentGrades.reduce((sum, grade) => sum + (grade.averages?.final_grade || 0), 0);
  const overallAverage = studentGrades.length > 0 ? totalGrades / studentGrades.length : 0;
  const sectionStudents = section ? await db.collection("section_students").find({ section_id: new ObjectId(student.section_id) }).toArray() : [];
  let previousQuarterAnalysis = null;
  if (previousQuarterGrades && previousQuarterGrades.length > 0 && previousQuarterInfo) {
    const prevGrades = previousQuarterGrades;
    const prevTotalGrades = prevGrades.reduce((sum, grade) => sum + (grade.averages?.final_grade || 0), 0);
    const prevOverallAverage = prevGrades.length > 0 ? prevTotalGrades / prevGrades.length : 0;
    console.log(`Previous quarter average calculated: ${prevOverallAverage} (from ${prevGrades.length} grades)`);
    const subjectComparisons = [];
    for (const currentGrade of studentGrades) {
      const prevGrade = prevGrades.find(
        (pg) => pg.subject_id.toString() === currentGrade.subject_id.toString()
      );
      if (prevGrade) {
        const subject = await db.collection("subjects").findOne({ _id: new ObjectId(currentGrade.subject_id) });
        const currentFinal = currentGrade.averages?.final_grade || 0;
        const prevFinal = prevGrade.averages?.final_grade || 0;
        const change = currentFinal - prevFinal;
        subjectComparisons.push({
          subjectName: subject?.name || "Unknown",
          currentGrade: currentFinal,
          previousGrade: prevFinal,
          change: Math.round(change * 100) / 100,
          trend: change > 0 ? "improved" : change < 0 ? "declined" : "stable",
          // Component comparisons
          writtenWork: {
            current: currentGrade.averages?.written_work || 0,
            previous: prevGrade.averages?.written_work || 0,
            change: (currentGrade.averages?.written_work || 0) - (prevGrade.averages?.written_work || 0)
          },
          performanceTasks: {
            current: currentGrade.averages?.performance_tasks || 0,
            previous: prevGrade.averages?.performance_tasks || 0,
            change: (currentGrade.averages?.performance_tasks || 0) - (prevGrade.averages?.performance_tasks || 0)
          },
          quarterlyAssessment: {
            current: currentGrade.averages?.quarterly_assessment || 0,
            previous: prevGrade.averages?.quarterly_assessment || 0,
            change: (currentGrade.averages?.quarterly_assessment || 0) - (prevGrade.averages?.quarterly_assessment || 0)
          }
        });
      }
    }
    previousQuarterAnalysis = {
      quarter: previousQuarterInfo.quarter,
      schoolYear: previousQuarterInfo.schoolYear,
      overallAverage: Math.round(prevOverallAverage * 100) / 100,
      overallChange: Math.round((overallAverage - prevOverallAverage) * 100) / 100,
      subjectComparisons
    };
    console.log(`Previous quarter analysis prepared:`, {
      quarter: previousQuarterAnalysis.quarter,
      schoolYear: previousQuarterAnalysis.schoolYear,
      overallAverage: previousQuarterAnalysis.overallAverage,
      overallChange: previousQuarterAnalysis.overallChange,
      comparisons: subjectComparisons.length
    });
  }
  const subjectBreakdown = [];
  for (const grade of studentGrades) {
    const subject = await db.collection("subjects").findOne({ _id: new ObjectId(grade.subject_id) });
    const teacher = await db.collection("users").findOne({ _id: new ObjectId(grade.teacher_id) });
    const gradeConfig = await db.collection("grade_configurations").findOne({
      section_id: new ObjectId(grade.section_id),
      subject_id: new ObjectId(grade.subject_id),
      grading_period_id: grade.quarter
    });
    const writtenWorkDetails = buildScoreDetails(
      grade.written_work || [],
      gradeConfig?.grade_items?.writtenWork || [],
      "Written Work"
    );
    const performanceTasksDetails = buildScoreDetails(
      grade.performance_tasks || [],
      gradeConfig?.grade_items?.performanceTasks || [],
      "Performance Tasks"
    );
    const quarterlyAssessmentDetails = buildScoreDetails(
      grade.quarterly_assessment || [],
      gradeConfig?.grade_items?.quarterlyAssessment || [],
      "Quarterly Assessment"
    );
    subjectBreakdown.push({
      name: subject?.name || "Unknown Subject",
      teacher: teacher ? `${teacher.first_name} ${teacher.last_name}` : "Unknown Teacher",
      overallGrade: grade.averages?.final_grade || 0,
      writtenWorkAverage: grade.averages?.written_work || 0,
      performanceTasksAverage: grade.averages?.performance_tasks || 0,
      quarterlyAssessmentAverage: grade.averages?.quarterly_assessment || 0,
      writtenWorkDetails,
      performanceTasksDetails,
      quarterlyAssessmentDetails,
      verified: grade.verified || false,
      quarter: grade.quarter,
      schoolYear: grade.school_year
    });
  }
  return {
    studentInfo: {
      name: `${student.first_name} ${student.last_name}`,
      gradeLevel: student.grade_level || "N/A",
      section: section?.name || "N/A",
      studentId: student.student_id || "N/A"
    },
    academicPerformance: {
      overallAverage: Math.round(overallAverage * 100) / 100,
      totalSubjects: studentGrades.length,
      totalStudentsInSection: sectionStudents.length || "N/A"
    },
    subjects: subjectBreakdown,
    previousQuarter: previousQuarterAnalysis
  };
}
function buildScoreDetails(scores, gradeItems, category) {
  if (!scores || scores.length === 0) {
    return { items: [], average: 0, count: 0 };
  }
  const items = scores.map((score, index) => {
    const item = gradeItems[index];
    const itemName = item?.name || `${category} ${index + 1}`;
    const totalScore = item?.totalScore || 100;
    const percentage = totalScore > 0 ? Math.round(score / totalScore * 100 * 100) / 100 : 0;
    return {
      name: itemName,
      score,
      totalScore,
      percentage
    };
  });
  const average = items.reduce((sum, item) => sum + item.percentage, 0) / items.length;
  return {
    items,
    average: Math.round(average * 100) / 100,
    count: items.length
  };
}
function createAnalysisPrompt(gradeData) {
  const { studentInfo, academicPerformance, subjects, previousQuarter } = gradeData;
  let prompt = `As an educational AI assistant, analyze the academic performance of ${studentInfo.name} (Student ID: ${studentInfo.studentId}), a Grade ${studentInfo.gradeLevel}.

ACADEMIC OVERVIEW:
- Overall Average: ${academicPerformance.overallAverage}
- Total Subjects: ${academicPerformance.totalSubjects}
- Section Size: ${academicPerformance.totalStudentsInSection} students
`;
  if (previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0) {
    const trend = previousQuarter.overallChange > 0 ? "📈 IMPROVED" : previousQuarter.overallChange < 0 ? "📉 DECLINED" : "➡️ STABLE";
    prompt += `
PREVIOUS QUARTER COMPARISON:
- Previous Quarter: Quarter ${previousQuarter.quarter} (${previousQuarter.schoolYear})
- Previous Overall Average: ${previousQuarter.overallAverage}
- Change: ${previousQuarter.overallChange > 0 ? "+" : ""}${previousQuarter.overallChange} ${trend}

SUBJECT-BY-SUBJECT COMPARISON:
`;
    previousQuarter.subjectComparisons.forEach((comparison) => {
      const trendEmoji = comparison.trend === "improved" ? "📈" : comparison.trend === "declined" ? "📉" : "➡️";
      prompt += `
  ${trendEmoji} ${comparison.subjectName}:
     Current: ${comparison.currentGrade} | Previous: ${comparison.previousGrade} | Change: ${comparison.change > 0 ? "+" : ""}${comparison.change}
     - Written Work: ${comparison.writtenWork.current}% (was ${comparison.writtenWork.previous}%, change: ${comparison.writtenWork.change > 0 ? "+" : ""}${Math.round(comparison.writtenWork.change * 100) / 100})
     - Performance Tasks: ${comparison.performanceTasks.current}% (was ${comparison.performanceTasks.previous}%, change: ${comparison.performanceTasks.change > 0 ? "+" : ""}${Math.round(comparison.performanceTasks.change * 100) / 100})
     - Quarterly Assessment: ${comparison.quarterlyAssessment.current}% (was ${comparison.quarterlyAssessment.previous}%, change: ${comparison.quarterlyAssessment.change > 0 ? "+" : ""}${Math.round(comparison.quarterlyAssessment.change * 100) / 100})
`;
    });
  } else {
    console.log("No previous quarter data available for comparison");
  }
  prompt += `
DETAILED SUBJECT BREAKDOWN:
`;
  subjects.forEach((subject) => {
    prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 ${subject.name} (Teacher: ${subject.teacher})
Quarter: ${subject.quarter} | School Year: ${subject.schoolYear}
Verified: ${subject.verified ? "Yes ✓" : "No ✗"}

Overall Grade: ${subject.overallGrade}

Component Averages:
- Written Work: ${subject.writtenWorkAverage}% (${subject.writtenWorkDetails.count} items)
- Performance Tasks: ${subject.performanceTasksAverage}% (${subject.performanceTasksDetails.count} items)  
- Quarterly Assessment: ${subject.quarterlyAssessmentAverage}% (${subject.quarterlyAssessmentDetails.count} items)
`;
    if (subject.writtenWorkDetails.items.length > 0) {
      prompt += `
📝 Written Work Details:
`;
      subject.writtenWorkDetails.items.forEach((item, idx) => {
        prompt += `   ${idx + 1}. ${item.name}: ${item.score}/${item.totalScore} (${item.percentage}%)
`;
      });
    }
    if (subject.performanceTasksDetails.items.length > 0) {
      prompt += `
🎯 Performance Tasks Details:
`;
      subject.performanceTasksDetails.items.forEach((item, idx) => {
        prompt += `   ${idx + 1}. ${item.name}: ${item.score}/${item.totalScore} (${item.percentage}%)
`;
      });
    }
    if (subject.quarterlyAssessmentDetails.items.length > 0) {
      prompt += `
📊 Quarterly Assessment Details:
`;
      subject.quarterlyAssessmentDetails.items.forEach((item, idx) => {
        prompt += `   ${idx + 1}. ${item.name}: ${item.score}/${item.totalScore} (${item.percentage}%)
`;
      });
    }
  });
  prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Analyze the grade data above and provide a supportive, empowering academic performance report.
${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? "\n⚠️ IMPORTANT: Include analysis of the previous quarter comparison data. Recognize improvements, acknowledge declines with encouragement, and identify patterns across quarters.\n" : ""}
Return a JSON object with this EXACT structure:

{
  "overallInsight": "A 2-3 sentence warm, personalized opening that recognizes the student's overall performance and effort${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? ". MUST mention their progress compared to the previous quarter (improved/declined/stable) with specific numbers" : ""}",
  "performanceLevel": "excellent|good|satisfactory|needs-improvement",
  ${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? `"quarterComparison": {
    "overallTrend": "improved|declined|stable",
    "changeAmount": ${previousQuarter.overallChange},
    "insight": "2-3 sentences analyzing the trend. If improved, celebrate it! If declined, offer encouragement and identify possible causes. If stable, discuss consistency.",
    "notableChanges": [
      {
        "subject": "Subject name with biggest change",
        "change": 5.5,
        "observation": "What this change might indicate"
      }
    ]
  },
  ` : ""}"strengths": [
    {
      "subject": "Subject name",
      "score": 95.5,
      "reason": "Specific reason why this is a strength (mention specific assessment types and scores${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? ", and note if this improved from last quarter" : ""})"
    }
  ],
  "areasForGrowth": [
    {
      "subject": "Subject name", 
      "score": 75.0,
      "currentGap": "Brief description of the gap${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? " and how it changed from last quarter" : ""}",
      "potential": "Encouraging note about potential for improvement"
    }
  ],
  "assessmentInsights": {
    "writtenWork": {
      "average": 85.5,
      "performance": "excellent|good|satisfactory|needs-improvement",
      "insight": "Brief encouraging insight about written work performance${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? " (mention if improved from last quarter)" : ""}"
    },
    "performanceTasks": {
      "average": 82.3,
      "performance": "excellent|good|satisfactory|needs-improvement", 
      "insight": "Brief encouraging insight about performance tasks${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? " (mention if improved from last quarter)" : ""}"
    },
    "quarterlyAssessment": {
      "average": 88.0,
      "performance": "excellent|good|satisfactory|needs-improvement",
      "insight": "Brief encouraging insight about quarterly assessments${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? " (mention if improved from last quarter)" : ""}"
    }
  },
  "actionPlan": [
    {
      "priority": "high|medium|low",
      "title": "Short action title",
      "description": "Specific, encouraging action step${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? ". For subjects that declined, suggest specific strategies to recover. For improved subjects, suggest maintaining momentum" : ""}",
      "expectedImpact": "What improvement this could bring"
    }
  ],
  "studyRecommendations": {
    "timeManagement": "Specific time management tip",
    "focusAreas": ["Subject 1", "Subject 2"],
    "strengthsToLeverage": "How to use their strengths to improve weaker areas${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? ". Mention patterns observed across quarters" : ""}"
  }
}

REQUIREMENTS:
- Use warm, second-person perspective in all text fields ("you", "your")
- Round all numeric scores to one decimal place
- Include MAXIMUM 3 items in strengths array (top performing subjects)
- Include 2-3 items in areasForGrowth array (subjects needing attention) - MINIMUM 2, MAXIMUM 3
- Include MAXIMUM 5 items in actionPlan array, ordered by priority (high/medium/low)
${previousQuarter && previousQuarter.subjectComparisons && previousQuarter.subjectComparisons.length > 0 ? "- CRITICAL: Thoroughly analyze the quarter-over-quarter comparison. This is valuable data!\n- Celebrate improvements enthusiastically. For declines, be supportive and solution-focused\n- Identify subjects that consistently perform well or poorly across quarters\n- " : ""}- Be genuinely encouraging while staying honest
- Use growth mindset language - frame weaknesses as opportunities
- Avoid judgmental words like "poor", "bad", "failing" - use "developing", "emerging", "growing"
- Make all recommendations feel achievable and supportive
- Provide specific, actionable advice
`;
  return prompt;
}

export { POST, config };
//# sourceMappingURL=_server-DdCIwo49.js.map
