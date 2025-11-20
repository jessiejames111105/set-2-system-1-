import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { verifyAuth } from '../helper/auth-helper.js';

/**
 * Parses a date string in MM-DD-YYYY format and returns a Date object
 * @param {string} dateStr - Date string in MM-DD-YYYY format
 * @returns {Date|null} - Date object or null if invalid
 */
function parseMMDDYYYY(dateStr) {
	if (!dateStr || dateStr.trim() === '') return null;
	
	const parts = dateStr.split('-');
	if (parts.length !== 3) return null;
	
	const [month, day, year] = parts.map(p => parseInt(p, 10));
	
	// Validate the parsed values
	if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
	if (month < 1 || month > 12) return null;
	if (day < 1 || day > 31) return null;
	
	// Create date object (month is 0-indexed in JavaScript)
	return new Date(year, month - 1, day);
}

/**
 * Determines the current quarter based on the system date and admin settings
 */
export async function GET({ request }) {
	try {
		// Verify authentication - all authenticated users can access
		const authResult = await verifyAuth(request);
		if (!authResult.success) {
			return json({ error: authResult.error || 'Authentication required' }, { status: 401 });
		}

		// Connect to database
		const db = await connectToDatabase();
		const adminSettingsCollection = db.collection('admin_settings');
		
		// Get all quarter date settings AND current school year
		const quarterSettings = await adminSettingsCollection.find({
			setting_key: { 
				$in: [
					'quarter_1_start_date', 'quarter_1_end_date',
					'quarter_2_start_date', 'quarter_2_end_date',
					'quarter_3_start_date', 'quarter_3_end_date',
					'quarter_4_start_date', 'quarter_4_end_date',
					'current_school_year' // Also fetch school year
				]
			}
		}).toArray();

		// Transform settings into an object
		const settings = {};
		quarterSettings.forEach(row => {
			settings[row.setting_key] = row.setting_value;
		});
		
		// Get current school year
		const currentSchoolYear = settings.current_school_year || '2025-2026';

		// Get current date (system date)
		const today = new Date();
		today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate date comparison

		// Define quarters with their date ranges
		const quarters = [
			{
				quarter: 1,
				name: '1st Quarter',
				startDate: parseMMDDYYYY(settings.quarter_1_start_date),
				endDate: parseMMDDYYYY(settings.quarter_1_end_date)
			},
			{
				quarter: 2,
				name: '2nd Quarter',
				startDate: parseMMDDYYYY(settings.quarter_2_start_date),
				endDate: parseMMDDYYYY(settings.quarter_2_end_date)
			},
			{
				quarter: 3,
				name: '3rd Quarter',
				startDate: parseMMDDYYYY(settings.quarter_3_start_date),
				endDate: parseMMDDYYYY(settings.quarter_3_end_date)
			},
			{
				quarter: 4,
				name: '4th Quarter',
				startDate: parseMMDDYYYY(settings.quarter_4_start_date),
				endDate: parseMMDDYYYY(settings.quarter_4_end_date)
			}
		];

		// Find the current quarter based on today's date
		let currentQuarter = null;
		
		for (const quarter of quarters) {
			// Skip if either start or end date is not set
			if (!quarter.startDate || !quarter.endDate) {
				continue;
			}

			// Check if today falls within this quarter's date range (inclusive)
			if (today >= quarter.startDate && today <= quarter.endDate) {
				currentQuarter = quarter;
				break;
			}
		}

		// Default to 1st quarter if no match found
		if (!currentQuarter) {
			currentQuarter = quarters[0]; // Default to 1st Quarter
		}

		return json({
			success: true,
			data: {
				currentQuarter: currentQuarter.quarter,
				quarterName: currentQuarter.name,
				currentSchoolYear: currentSchoolYear,
				startDate: currentQuarter.startDate ? currentQuarter.startDate.toISOString() : null,
				endDate: currentQuarter.endDate ? currentQuarter.endDate.toISOString() : null,
				systemDate: today.toISOString(),
				allQuarters: quarters.map(q => ({
					quarter: q.quarter,
					name: q.name,
					startDate: q.startDate ? q.startDate.toISOString() : null,
					endDate: q.endDate ? q.endDate.toISOString() : null,
					isActive: q.quarter === currentQuarter?.quarter
				}))
			}
		});

	} catch (error) {
		console.error('Error determining current quarter:', error);
		return json(
			{ 
				error: 'Failed to determine current quarter',
				details: error.message 
			},
			{ status: 500 }
		);
	}
}
