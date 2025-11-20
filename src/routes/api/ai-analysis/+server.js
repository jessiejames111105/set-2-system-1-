import { json } from '@sveltejs/kit';
import { OPENROUTER_AI_KEY } from '$env/static/private';

export async function POST({ request }) {
	try {
		const { data, type } = await request.json();

		if (!data || !type) {
			return json({ success: false, error: 'Missing required parameters' }, { status: 400 });
		}

		let prompt = '';

		if (type === 'sectionsPerGrade') {
			prompt = `Analyze this junior high school section distribution data for grades 7-10: ${JSON.stringify(data)}. Identify significant imbalances (differences >2 sections between grades) and provide a brief 2-3 sentence analysis with one specific actionable recommendation. Focus on resource allocation and student experience for grades 7-10. Be concise.`;
		} else if (type === 'studentsPerGrade') {
			prompt = `Analyze this junior high school student distribution data for grades 7-10: ${JSON.stringify(data)}. Identify significant imbalances in student numbers across grades 7-10 and provide a brief 2-3 sentence analysis with one specific actionable recommendation. Focus on capacity planning and enrollment strategies for grades 7-10. Be concise.`;
		} else if (type === 'teachersPerDepartment') {
			prompt = `Analyze this teacher department distribution data: ${JSON.stringify(data)}. Identify staffing imbalances and provide a brief 2-3 sentence analysis with one specific actionable recommendation. Focus on workload distribution and hiring priorities. Be concise.`;
		} else {
			return json({ success: false, error: 'Invalid analysis type' }, { status: 400 });
		}

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${OPENROUTER_AI_KEY}`,
				'HTTP-Referer': 'https://set-2-system.vercel.app',
				'X-Title': 'SET-2 System',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: 'meta-llama/llama-3.3-70b-instruct',
				messages: [
					{
						role: 'user',
						content: prompt
					}
				]
			})
		});

		if (!response.ok) {
			throw new Error('OpenRouter API request failed');
		}

		const result = await response.json();
		const analysis = result.choices[0].message.content;

		return json({ success: true, analysis });
	} catch (error) {
		console.error('AI Analysis Error:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
}
