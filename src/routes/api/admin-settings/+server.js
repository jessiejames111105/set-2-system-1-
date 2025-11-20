import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { getUserFromRequest, logActivityWithUser } from '../helper/auth-helper.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request }) {
	try {
		// Get user from request
		const user = getUserFromRequest(request);
		if (!user || user.account_type !== 'admin') {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get all admin settings from database
		const db = await connectToDatabase();
		const adminSettingsCollection = db.collection('admin_settings');
		
		const result = await adminSettingsCollection.find({}).sort({ setting_key: 1 }).toArray();

		// Transform the result into a more usable format
		const settings = {};
		result.forEach(row => {
			let value = row.setting_value;
			
			// Convert value based on type
			if (row.setting_type === 'number' && value !== null) {
				value = parseFloat(value);
			} else if (row.setting_type === 'boolean' && value !== null) {
				value = value === 'true';
			} else if (row.setting_type === 'date' && value !== null) {
				// Keep date in MM-DD-YYYY format as expected by the frontend
				// No conversion needed - return as stored
				value = value;
			} else if (row.setting_type === 'json' && value !== null) {
				try {
					value = JSON.parse(value);
				} catch (e) {
					console.error('Failed to parse JSON setting:', row.setting_key, e);
				}
			}
			
			settings[row.setting_key] = value;
		});

		return json({
			success: true,
			data: settings
		});

	} catch (error) {
		console.error('Error fetching admin settings:', error);
		return json(
			{ error: 'Failed to fetch admin settings' },
			{ status: 500 }
		);
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PUT(event) {
  const user = getUserFromRequest(event.request);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (user.account_type !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { settings } = await event.request.json();
    
    if (!settings || typeof settings !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid settings data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Connect to MongoDB
    const db = await connectToDatabase();
    const adminSettingsCollection = db.collection('admin_settings');

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      let stringValue = value;
      
      // Convert value to string for storage
      if (typeof value === 'object' && value !== null) {
        stringValue = JSON.stringify(value);
      } else if (value !== null) {
        stringValue = String(value);
      }

      // For date settings, validate the MM-DD-YYYY format
      if (key.includes('date') && value !== null && value !== '') {
        const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-\d{4}$/;
        if (!dateRegex.test(value)) {
          throw new Error(`Invalid date format for ${key}. Expected MM-DD-YYYY format.`);
        }
        // Validate that it's a real date by parsing MM-DD-YYYY
        const [month, day, year] = value.split('-');
        const date = new Date(year, month - 1, day);
        if (isNaN(date.getTime()) || 
          date.getFullYear() != year || 
          date.getMonth() != month - 1 || 
          date.getDate() != day) {
          throw new Error(`Invalid date value for ${key}: ${value}`);
        }
      }

      await adminSettingsCollection.updateOne(
        { setting_key: key },
        { 
          $set: { 
            setting_value: stringValue, 
            updated_at: new Date() 
          } 
        },
        { upsert: true }
      );
    }

    // Log the activity
    await logActivityWithUser(
      'admin_settings_updated',
      JSON.stringify({ updated_settings: Object.keys(settings) }),
      user,
      event.getClientAddress()
    );

    return new Response(JSON.stringify({
      success: true,
      message: 'Settings updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating admin settings:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}