import { j as json } from './index-CccDCyu_.js';
import { a as connectToDatabase } from './db-C-gxO138.js';
import 'mongodb';
import 'dotenv';

function parseMMDDYYYY(dateStr) {
  if (!dateStr || dateStr.trim() === "") return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const [month, day, year] = parts.map((p) => parseInt(p, 10));
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}
async function GET({ request }) {
  try {
    const db = await connectToDatabase();
    const adminSettingsCollection = db.collection("admin_settings");
    const quarterSettings = await adminSettingsCollection.find({
      setting_key: {
        $in: [
          "quarter_1_start_date",
          "quarter_1_end_date",
          "quarter_2_start_date",
          "quarter_2_end_date",
          "quarter_3_start_date",
          "quarter_3_end_date",
          "quarter_4_start_date",
          "quarter_4_end_date",
          "current_school_year"
          // Also fetch school year
        ]
      }
    }).toArray();
    const settings = {};
    quarterSettings.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    const currentSchoolYear = settings.current_school_year || "2025-2026";
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const quarters = [
      {
        quarter: 1,
        name: "1st Quarter",
        startDate: parseMMDDYYYY(settings.quarter_1_start_date),
        endDate: parseMMDDYYYY(settings.quarter_1_end_date)
      },
      {
        quarter: 2,
        name: "2nd Quarter",
        startDate: parseMMDDYYYY(settings.quarter_2_start_date),
        endDate: parseMMDDYYYY(settings.quarter_2_end_date)
      },
      {
        quarter: 3,
        name: "3rd Quarter",
        startDate: parseMMDDYYYY(settings.quarter_3_start_date),
        endDate: parseMMDDYYYY(settings.quarter_3_end_date)
      },
      {
        quarter: 4,
        name: "4th Quarter",
        startDate: parseMMDDYYYY(settings.quarter_4_start_date),
        endDate: parseMMDDYYYY(settings.quarter_4_end_date)
      }
    ];
    let currentQuarter = null;
    for (const quarter of quarters) {
      if (!quarter.startDate || !quarter.endDate) {
        continue;
      }
      if (today >= quarter.startDate && today <= quarter.endDate) {
        currentQuarter = quarter;
        break;
      }
    }
    if (!currentQuarter) {
      currentQuarter = quarters[0];
    }
    return json({
      success: true,
      data: {
        currentQuarter: currentQuarter.quarter,
        quarterName: currentQuarter.name,
        currentSchoolYear,
        startDate: currentQuarter.startDate ? currentQuarter.startDate.toISOString() : null,
        endDate: currentQuarter.endDate ? currentQuarter.endDate.toISOString() : null,
        systemDate: today.toISOString(),
        allQuarters: quarters.map((q) => ({
          quarter: q.quarter,
          name: q.name,
          startDate: q.startDate ? q.startDate.toISOString() : null,
          endDate: q.endDate ? q.endDate.toISOString() : null,
          isActive: q.quarter === currentQuarter?.quarter
        }))
      }
    });
  } catch (error) {
    console.error("Error determining current quarter:", error);
    return json(
      {
        error: "Failed to determine current quarter",
        details: error.message
      },
      { status: 500 }
    );
  }
}

export { GET };
//# sourceMappingURL=_server-Ch7s5C0j.js.map
