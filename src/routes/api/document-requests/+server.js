import { json } from '@sveltejs/kit';
import { connectToDatabase } from '../../database/db.js';
import { ObjectId } from 'mongodb';
import { verifyAuth, logActivityWithUser, getUserFromRequest } from '../helper/auth-helper.js';
import { encryptMessage, decryptMessages } from '../helper/encryption-helper.js';
import PDFDocument from 'pdfkit';

// Document type price mapping
const DOCUMENT_PRICES = {
	'Transcript of Records': 300.00,
	'Enrollment Certificate': 150.00,
	'Grade Report': 50.00,
	'Diploma': 800.00,
	'Certificate': 100.00,
	'Good Moral': 300.00,
	'Grade Slip': 170.00
};

// Helper function to get document price
function getDocumentPrice(documentType) {
	return DOCUMENT_PRICES[documentType] || null;
}

// Helper function to create notifications for document request updates
async function createDocumentRequestNotification(db, studentId, notificationData) {
	try {
		const notification = {
			student_id: studentId,
			title: notificationData.title,
			message: notificationData.message,
			type: 'document',
			priority: notificationData.priority || 'normal',
			is_read: false,
			related_id: notificationData.requestId,
			document_type: notificationData.documentType,
			status: notificationData.status,
			admin_name: notificationData.adminName,
			admin_id: notificationData.adminId,
			admin_note: notificationData.adminNote || null,
			created_at: new Date(),
			updated_at: new Date()
		};

		await db.collection('notifications').insertOne(notification);
		console.log(`Notification created for student ${studentId}: ${notificationData.title}`);
	} catch (error) {
		console.error('Error creating notification:', error);
		// Don't fail the main operation if notification fails
	}
}

// Helper function to send automated message to document request thread
async function sendAutomatedStatusMessage(db, requestId, status, adminName, tentativeDate = null, paymentAmount = null, paymentStatus = null) {
	try {
		const statusNames = {
			'on_hold': 'On Hold',
			'verifying': 'Verifying',
			'processing': 'For Processing',
			'for_pickup': 'For Pick Up',
			'released': 'Released',
			'rejected': 'Rejected',
			'cancelled': 'Cancelled'
		};

		const statusMessages = {
			'on_hold': 'Your document request is currently on hold and awaiting review.',
			'verifying': 'Your document request is now being verified. We will update you once verification is complete.',
			'processing': 'Your document request is now being processed. We will notify you once it\'s ready.',
			'for_pickup': 'Your document is ready for pickup! Please visit the office to collect your document.',
			'released': 'Your document has been released. Thank you for using our services!',
			'rejected': 'Your document request has been rejected. Please contact the office for more information.',
			'cancelled': 'Your document request has been cancelled.'
		};

		let messageText = `Status Update: Your document request status has been changed to "${statusNames[status] || status}". ${statusMessages[status] || ''}`;
		
		// Add tentative date if available and status is processing
		if (tentativeDate && status === 'processing') {
			const date = new Date(tentativeDate);
			const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
			messageText += ` Tentative completion date: ${formattedDate}.`;
		}

		// Add payment amount if available and payment status is not 'paid'
		// (If payment is already paid, don't include amount in status message as it's redundant)
		if (paymentAmount !== null && paymentAmount !== undefined && paymentStatus !== 'paid') {
			messageText += ` Payment amount: ₱${paymentAmount}.`;
		}

		// Encrypt the message text
		const encryptedText = encryptMessage(messageText.trim());

		// Create the automated message
		const automatedMessage = {
			id: new ObjectId().toString(),
			author: adminName || 'System',
			authorId: null, // System message
			authorRole: 'admin',
			text: encryptedText,
			attachments: [],
			created_at: new Date(),
			isAutomated: true // Flag to identify automated messages
		};

		// Add message to the document request
		await db.collection('document_requests').updateOne(
			{ request_id: requestId },
			{
				$push: { messages: automatedMessage },
				$set: { updated_at: new Date() }
			}
		);

		console.log(`Automated status message sent for request ${requestId}: ${status}`);
	} catch (error) {
		console.error('Error sending automated status message:', error);
		// Don't fail the main operation if message sending fails
	}
}

// Helper function to send automated payment confirmation message
async function sendAutomatedPaymentMessage(db, requestId, paymentAmount, adminName) {
	try {
		const messageText = `Payment Confirmed: Your payment of ₱${paymentAmount} has been confirmed and recorded. Thank you for your payment!`;

		// Encrypt the message text
		const encryptedText = encryptMessage(messageText.trim());

		// Create the automated message
		const automatedMessage = {
			id: new ObjectId().toString(),
			author: adminName || 'System',
			authorId: null, // System message
			authorRole: 'admin',
			text: encryptedText,
			attachments: [],
			created_at: new Date(),
			isAutomated: true // Flag to identify automated messages
		};

		// Add message to the document request
		await db.collection('document_requests').updateOne(
			{ request_id: requestId },
			{
				$push: { messages: automatedMessage },
				$set: { updated_at: new Date() }
			}
		);

		console.log(`Automated payment message sent for request ${requestId}: ₱${paymentAmount}`);
	} catch (error) {
		console.error('Error sending automated payment message:', error);
		// Don't fail the main operation if message sending fails
	}
}

// Helper function to send automated payment amount set message
async function sendAutomatedPaymentAmountMessage(db, requestId, paymentAmount, adminName, isFirstTime = false) {
	try {
		const messageText = isFirstTime 
			? `Payment Amount Set: The payment amount for your document request has been set to ₱${paymentAmount}. Please proceed with the payment when ready.`
			: `Payment Amount Updated: The payment amount for your document request has been updated to ₱${paymentAmount}. Please proceed with the payment when ready.`;

		// Encrypt the message text
		const encryptedText = encryptMessage(messageText.trim());

		// Create the automated message
		const automatedMessage = {
			id: new ObjectId().toString(),
			author: adminName || 'System',
			authorId: null, // System message
			authorRole: 'admin',
			text: encryptedText,
			attachments: [],
			created_at: new Date(),
			isAutomated: true // Flag to identify automated messages
		};

		// Add message to the document request
		await db.collection('document_requests').updateOne(
			{ request_id: requestId },
			{
				$push: { messages: automatedMessage },
				$set: { updated_at: new Date() }
			}
		);

		console.log(`Automated payment amount message sent for request ${requestId}: ₱${paymentAmount}`);
	} catch (error) {
		console.error('Error sending automated payment amount message:', error);
		// Don't fail the main operation if message sending fails
	}
}

// Helper function to send automated tentative date message
async function sendAutomatedTentativeDateMessage(db, requestId, tentativeDate, adminName, currentStatus = 'processing') {
	try {
		const date = new Date(tentativeDate);
		const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
		
		// Adjust message based on current status
		let statusMessage = 'ready for pickup';
		if (currentStatus === 'verifying') {
			statusMessage = 'ready for processing';
		} else if (currentStatus === 'processing') {
			statusMessage = 'ready for pickup';
		}
		
		const messageText = `Tentative Date Set: Your document request has a tentative completion date of ${formattedDate}. We will notify you once your document is ${statusMessage}.`;

		// Encrypt the message text
		const encryptedText = encryptMessage(messageText.trim());

		// Create the automated message
		const automatedMessage = {
			id: new ObjectId().toString(),
			author: adminName || 'System',
			authorId: null, // System message
			authorRole: 'admin',
			text: encryptedText,
			attachments: [],
			created_at: new Date(),
			isAutomated: true // Flag to identify automated messages
		};

		// Add message to the document request
		await db.collection('document_requests').updateOne(
			{ request_id: requestId },
			{
				$push: { messages: automatedMessage },
				$set: { updated_at: new Date() }
			}
		);

		console.log(`Automated tentative date message sent for request ${requestId}: ${formattedDate}`);
	} catch (error) {
		console.error('Error sending automated tentative date message:', error);
		// Don't fail the main operation if message sending fails
	}
}

// GET /api/document-requests - Fetch document requests
export async function GET({ url, request }) {
	try {
		// Verify authentication (students can view their own, admin/teachers can view all)
		const authResult = await verifyAuth(request, ['admin', 'teacher', 'student']);
		if (!authResult.success) {
			return json({ error: authResult.error }, { status: 401 });
		}

		const db = await connectToDatabase();
		const action = url.searchParams.get('action');

		switch (action) {
			case 'all':
				// Get all document requests with optional filters (admin/teacher only)
				if (authResult.user.account_type !== 'admin' && authResult.user.account_type !== 'teacher') {
					return json({ error: 'Access denied. Only admins and teachers can view all requests.' }, { status: 403 });
				}

				const status = url.searchParams.get('status');
				const documentType = url.searchParams.get('documentType');
				const gradeLevel = url.searchParams.get('gradeLevel');
				const searchTerm = url.searchParams.get('search');

				// Build query
				let query = {};

				if (status) {
					query.status = status;
				}

				if (documentType) {
					query.document_type = documentType;
				}

				if (gradeLevel) {
					query.grade_level = gradeLevel.toString();
				}

				if (searchTerm) {
					query.$or = [
						{ full_name: { $regex: searchTerm, $options: 'i' } },
						{ account_number: { $regex: searchTerm, $options: 'i' } },
						{ request_id: { $regex: searchTerm, $options: 'i' } },
						{ document_type: { $regex: searchTerm, $options: 'i' } }
					];
				}

				const requests = await db
					.collection('document_requests')
					.find(query)
					.sort({ submitted_date: -1 })
					.toArray();

				// Format the data for the frontend
				const formattedRequests = requests.map((req) => ({
					id: req._id.toString(),
					studentId: req.account_number,
					gradeLevel: `Grade ${req.grade_level}`,
					section: req.section,
					studentName: req.full_name,
					documentType: req.document_type,
					quantity: req.quantity || 1,
					requestId: req.request_id,
					submittedDate: formatDate(req.submitted_date),
					cancelledDate: req.cancelled_date ? formatDate(req.cancelled_date) : null,
					payment: req.payment_amount !== null && req.payment_amount !== undefined 
						? (req.payment_amount === 0 ? 'Free' : `₱${req.payment_amount}`) 
						: 'Tentative',
					paymentAmount: req.payment_amount,
					paymentStatus: req.payment_status,
					isFirstTime: req.is_first_time || false,
					status: req.status,
					tentativeDate: req.tentative_date ? formatDateForInput(req.tentative_date) : null,
					isUrgent: req.is_urgent || false,
					purpose: req.purpose,
					dateOfBirth: formatDateDisplay(req.birthdate),
					processedBy: req.processed_by,
					processedById: req.processed_by_id,
					messages: decryptMessages(req.messages || []),
					lastReadAt: req.last_read_at || null,
					statusHistory: req.status_history || []
				}));

				return json({ success: true, data: formattedRequests });

			case 'student':
				// Get student's own document requests
				const studentRequests = await db
					.collection('document_requests')
					.find({ student_id: authResult.user.id })
					.sort({ submitted_date: -1 })
					.toArray();

			const formattedStudentRequests = studentRequests.map((req) => ({
				id: req._id.toString(),
				requestId: req.request_id,
				documentType: req.document_type,
				quantity: req.quantity || 1,
				purpose: req.purpose,
				status: req.status,
				submittedDate: formatDate(req.submitted_date),
				cancelledDate: req.cancelled_date ? formatDate(req.cancelled_date) : null,
				tentativeDate: req.tentative_date ? formatDate(req.tentative_date) : null,
				payment: req.payment_amount !== null && req.payment_amount !== undefined 
					? (req.payment_amount === 0 ? 'Free' : `₱${req.payment_amount}`) 
					: 'Tentative',
				paymentAmount: req.payment_amount,
				paymentStatus: req.payment_status,
				isFirstTime: req.is_first_time || false,
				processedBy: req.processed_by,
				isUrgent: req.is_urgent || false,
				messages: decryptMessages(req.messages || []),
				lastReadAt: req.last_read_at || null,
				statusHistory: req.status_history || []
			}));

				return json({ success: true, data: formattedStudentRequests });

			case 'stats':
				// Get statistics for status cards
				const stats = await db
					.collection('document_requests')
					.aggregate([
						{
							$group: {
								_id: '$status',
								count: { $sum: 1 }
							}
						}
					])
					.toArray();

				const statsObj = {
					on_hold: 0,
					verifying: 0,
					processing: 0,
					for_pickup: 0,
					released: 0
				};

				stats.forEach((stat) => {
					if (statsObj.hasOwnProperty(stat._id)) {
						statsObj[stat._id] = stat.count;
					}
				});

				return json({ success: true, data: statsObj });

			case 'single':
				const requestId = url.searchParams.get('requestId');
				if (!requestId) {
					return json({ error: 'Request ID is required' }, { status: 400 });
				}

				const request = await db.collection('document_requests').findOne({ request_id: requestId });

				if (!request) {
					return json({ error: 'Request not found' }, { status: 404 });
				}

				// Ensure messages field exists (migration fix)
				if (!request.messages) {
					await db.collection('document_requests').updateOne(
						{ request_id: requestId },
						{ $set: { messages: [] } }
					);
					request.messages = [];
				}

				const formattedRequest = {
					id: request._id.toString(),
					studentId: request.account_number,
					gradeLevel: `Grade ${request.grade_level}`,
					section: request.section,
					studentName: request.full_name,
					documentType: request.document_type,
					quantity: request.quantity || 1,
					requestId: request.request_id,
					submittedDate: formatDate(request.submitted_date),
					cancelledDate: request.cancelled_date ? formatDate(request.cancelled_date) : null,
					payment: request.payment_amount !== null && request.payment_amount !== undefined 
						? (request.payment_amount === 0 ? 'Free' : `₱${request.payment_amount}`) 
						: 'Tentative',
					paymentAmount: request.payment_amount,
					paymentStatus: request.payment_status,
					isFirstTime: request.is_first_time || false,
					status: request.status,
					tentativeDate: request.tentative_date ? formatDateForInput(request.tentative_date) : null,
					isUrgent: request.is_urgent || false,
					purpose: request.purpose,
					dateOfBirth: formatDateDisplay(request.birthdate),
					processedBy: request.processed_by,
					processedById: request.processed_by_id,
					messages: decryptMessages(request.messages || []),
					lastReadAt: request.last_read_at || null,
					statusHistory: request.status_history || []
				};

				return json({ success: true, data: formattedRequest });

			case 'generateReceipt':
				// Only admins and teachers can generate receipts
				if (authResult.user.account_type !== 'admin' && authResult.user.account_type !== 'teacher') {
					return json({ error: 'Access denied. Only admins and teachers can generate receipts.' }, { status: 403 });
				}

				const receiptRequestId = url.searchParams.get('requestId');
				if (!receiptRequestId) {
					return json({ error: 'Request ID is required' }, { status: 400 });
				}

				const receiptRequest = await db.collection('document_requests').findOne({ request_id: receiptRequestId });
				if (!receiptRequest) {
					return json({ error: 'Request not found' }, { status: 404 });
				}

				// Generate PDF receipt
				try {
					const pdfBuffer = await generateReceiptPDF(receiptRequest);
					return new Response(pdfBuffer, {
						headers: {
							'Content-Type': 'application/pdf',
							'Content-Disposition': `attachment; filename="receipt-${receiptRequestId}.pdf"`
						}
					});
				} catch (pdfError) {
					console.error('Error generating PDF receipt:', pdfError);
					return json({ error: 'Failed to generate receipt PDF' }, { status: 500 });
				}

			default:
				return json({ error: 'Invalid action parameter' }, { status: 400 });
		}
	} catch (error) {
		console.error('Error in /api/document-requests GET:', error);
		return json({ error: 'Failed to fetch document requests' }, { status: 500 });
	}
}

// POST /api/document-requests - Create or update document request
export async function POST({ request }) {
	try {
		// Verify authentication
		const authResult = await verifyAuth(request, ['admin', 'teacher', 'student']);
		if (!authResult.success) {
			return json({ error: authResult.error }, { status: 401 });
		}

		const user = authResult.user;
		const db = await connectToDatabase();
		const data = await request.json();
		const { action } = data;

		switch (action) {
			case 'create':
				// Students can create their own requests
				if (user.account_type === 'student') {
					// Get student information from users collection
					const student = await db
						.collection('users')
						.findOne({ _id: new ObjectId(user.id) });

					if (!student) {
						return json({ error: 'Student not found' }, { status: 404 });
					}

					// Generate request ID
					const lastRequest = await db
						.collection('document_requests')
						.find()
						.sort({ request_id: -1 })
						.limit(1)
						.toArray();

					let nextRequestNumber = 1;
					if (lastRequest.length > 0) {
						const lastId = lastRequest[0].request_id;
						const match = lastId.match(/REQ-(\d+)-(\d+)/);
						if (match) {
							nextRequestNumber = parseInt(match[2]) + 1;
						}
					}

					const requestId = `REQ-${new Date().getFullYear()}-${String(nextRequestNumber).padStart(4, '0')}`;

					// Get student's section
					const sectionStudent = await db
						.collection('section_students')
						.findOne({ student_id: new ObjectId(user.id), status: 'active' });

					let sectionName = 'N/A';
					if (sectionStudent) {
						const section = await db
							.collection('sections')
							.findOne({ _id: sectionStudent.section_id });
						if (section) {
							sectionName = section.name;
						}
					}

					// Check if this is the student's first request for this document type
					const previousRequests = await db
						.collection('document_requests')
						.find({
							student_id: student._id.toString(),
							document_type: data.documentType,
							status: { $in: ['released', 'for_pickup', 'processing', 'verifying'] } // Only count completed or in-progress requests
						})
						.toArray();

					const isFirstTime = previousRequests.length === 0;

					// Get the fixed price for the document type
					const documentPrice = getDocumentPrice(data.documentType);
					const quantity = data.quantity || 1;
					// First-time requests: only the first copy is free, additional copies are charged
					// Non-first-time requests: all copies are charged
					const totalPayment = isFirstTime 
						? (documentPrice ? documentPrice * (quantity - 1) : null) 
						: (documentPrice ? documentPrice * quantity : null);

					const newRequest = {
						student_id: student._id.toString(),
						account_number: student.account_number,
						full_name: student.full_name,
						grade_level: student.grade_level,
						section: sectionName,
						birthdate: student.birthdate,
						document_type: data.documentType,
						quantity: quantity,
						request_id: requestId,
						submitted_date: new Date(),
						payment_amount: totalPayment,
						payment_status: totalPayment === 0 ? 'paid' : 'pending', // Free requests are automatically marked as paid
						is_first_time: isFirstTime,
						status: 'on_hold',
						tentative_date: null,
						is_urgent: data.isUrgent || false,
						purpose: data.purpose,
						processed_by: null,
						processed_by_id: null,
						messages: [],
						status_history: [
							{
								status: 'on_hold',
								timestamp: new Date(),
								changedBy: 'System',
								note: isFirstTime 
									? (quantity === 1 
										? 'Request submitted and awaiting review (First-time request - Free)' 
										: `Request submitted and awaiting review (First-time request - 1st copy free, ${quantity - 1} additional ${quantity - 1 === 1 ? 'copy' : 'copies'} charged)`)
									: 'Request submitted and awaiting review'
							}
						],
						created_at: new Date(),
						updated_at: new Date()
					};

					const result = await db.collection('document_requests').insertOne(newRequest);

					// Log activity
					await logActivityWithUser(
						'document_request_created',
						`Document request ${requestId} created for ${data.documentType}`,
						user
					);

					return json({
						success: true,
						message: 'Document request created successfully',
						data: { ...newRequest, id: result.insertedId.toString() }
					});
				} else {
					return json({ error: 'Only students can create requests' }, { status: 403 });
				}

			case 'update':
				// Admin and teachers can update requests
				if (user.account_type !== 'admin' && user.account_type !== 'teacher') {
					return json({ error: 'Permission denied' }, { status: 403 });
				}

				const { requestId, status, tentativeDate, paymentStatus, paymentAmount } = data;

				if (!requestId) {
					return json({ error: 'Request ID is required' }, { status: 400 });
				}

				const updateData = {
					updated_at: new Date()
				};

				// Get existing request first to track changes
				const existingRequest = await db
					.collection('document_requests')
					.findOne({ request_id: requestId });

				if (!existingRequest) {
					return json({ error: 'Request not found' }, { status: 404 });
				}

				// Track what changed for notifications and logging
				let statusChanged = false;
				let paymentStatusChanged = false;
				let tentativeDateChanged = false;
				let oldStatus = existingRequest.status;
				let oldPaymentStatus = existingRequest.payment_status;
				let oldPaymentAmount = existingRequest.payment_amount;
				let oldTentativeDate = existingRequest.tentative_date;

				if (status) {
					updateData.status = status;
					statusChanged = (status !== oldStatus);
					// Clear tentative date if status is not processing
					if (status !== 'processing') {
						updateData.tentative_date = null;
					}
					
					// Add to status history if status changed
					if (statusChanged) {
						// Get appropriate note based on status
						const statusNotes = {
							'on_hold': 'Request is on hold and awaiting admin review',
							'verifying': 'Admin is verifying the request details and requirements',
							'processing': 'Document is being prepared and processed',
							'for_pickup': 'Document is ready and available for pickup at the office',
							'released': 'Document has been successfully released to the student',
							'rejected': 'Request has been rejected by admin',
							'cancelled': 'Request was cancelled'
						};
						
						const statusHistoryEntry = {
							status: status,
							timestamp: new Date(),
							changedBy: user.name || user.full_name || 'Admin',
							note: statusNotes[status] || 'Status updated'
						};
						
						// Push to status_history array
						updateData.$push = updateData.$push || {};
						updateData.$push.status_history = statusHistoryEntry;
					}
				}

				if (tentativeDate !== undefined) {
					const newTentativeDate = tentativeDate ? new Date(tentativeDate) : null;
					updateData.tentative_date = newTentativeDate;
					// Track if tentative date changed (only if it's being set, not cleared)
					// Compare dates by converting to ISO string for accurate comparison
					const oldDateStr = oldTentativeDate ? new Date(oldTentativeDate).toISOString().split('T')[0] : null;
					const newDateStr = newTentativeDate ? new Date(newTentativeDate).toISOString().split('T')[0] : null;
					tentativeDateChanged = (newDateStr !== oldDateStr && newTentativeDate !== null);
				}

				if (paymentStatus !== undefined) {
					updateData.payment_status = paymentStatus;
					// Check if payment status changed to 'paid' (handle null/undefined oldPaymentStatus)
					const oldStatus = oldPaymentStatus || 'pending';
					paymentStatusChanged = (paymentStatus !== oldStatus && paymentStatus === 'paid');
				}

				// Set processed by if not already set
				if (!existingRequest.processed_by) {
					updateData.processed_by = user.name;
					updateData.processed_by_id = user.id;
				}

				// Build the update operation
				const updateOperation = { $set: updateData };
				if (updateData.$push) {
					updateOperation.$push = updateData.$push;
					delete updateData.$push;
				}

				const updateResult = await db
					.collection('document_requests')
					.updateOne({ request_id: requestId }, updateOperation);

				if (updateResult.matchedCount === 0) {
					return json({ error: 'Request not found' }, { status: 404 });
				}

				// Send notifications for changes
				// 1. Notify on status change
				if (statusChanged) {
					const statusNames = {
						'on_hold': 'On Hold',
						'verifying': 'Verifying',
						'processing': 'Processing',
						'for_pickup': 'Ready for Pickup',
						'released': 'Released',
						'rejected': 'Rejected',
						'cancelled': 'Cancelled'
					};
					
					const statusMessages = {
						'on_hold': 'Your document request is currently on hold.',
						'verifying': 'Your document request is now being verified.',
						'processing': 'Your document request is being processed.',
						'for_pickup': 'Your document is ready for pickup! Please visit the office.',
						'released': 'Your document has been released. Thank you!',
						'rejected': 'Your document request has been rejected.',
						'cancelled': 'Your document request has been cancelled.'
					};

					// Send automated message to document request thread
					// Use tentativeDate from input (if provided), and paymentAmount from input or existing
					const finalTentativeDate = tentativeDate !== undefined ? tentativeDate : null;
					const finalPaymentAmount = paymentAmount !== undefined && paymentAmount !== null ? paymentAmount : (existingRequest.payment_amount || null);
					// Get current payment status (use new status if changed, otherwise existing status)
					const finalPaymentStatus = updateData.payment_status || existingRequest.payment_status || null;
					
					await sendAutomatedStatusMessage(
						db,
						requestId,
						status,
						user.name || user.full_name,
						finalTentativeDate,
						finalPaymentAmount,
						finalPaymentStatus
					);

					await createDocumentRequestNotification(db, existingRequest.student_id, {
						title: `Document Request Status Updated`,
						message: `Your request for "${existingRequest.document_type}" (${requestId}) status changed to: ${statusNames[status]}. ${statusMessages[status] || ''}`,
						priority: status === 'for_pickup' ? 'high' : 'normal',
						requestId: requestId,
						documentType: existingRequest.document_type,
						status: status,
						adminName: user.name,
						adminId: user.id
					});
				}

				// 2. Notify on payment status change to 'paid'
				if (paymentStatusChanged) {
					const paymentAmount = existingRequest.payment_amount || 0;
					
					// Send automated message to document request thread
					await sendAutomatedPaymentMessage(
						db,
						requestId,
						paymentAmount,
						user.name || user.full_name
					);

					await createDocumentRequestNotification(db, existingRequest.student_id, {
						title: `Payment Confirmed`,
						message: `Your payment for "${existingRequest.document_type}" (${requestId}) has been confirmed as paid. Amount: ₱${paymentAmount}`,
						priority: 'normal',
						requestId: requestId,
						documentType: existingRequest.document_type,
						status: existingRequest.status,
						adminName: user.name,
						adminId: user.id
					});
				}

				// 3. Notify on tentative date change
				if (tentativeDateChanged) {
					const finalTentativeDate = tentativeDate !== undefined ? tentativeDate : (updateData.tentative_date || null);
					
					if (finalTentativeDate) {
						// Get current status (use new status if changed, otherwise existing status)
						const currentStatus = updateData.status || existingRequest.status || 'processing';
						
						// Send automated message to document request thread
						await sendAutomatedTentativeDateMessage(
							db,
							requestId,
							finalTentativeDate,
							user.name || user.full_name,
							currentStatus
						);
					}
				}

				// Log activity with detailed information
				await logActivityWithUser(
					'document_request_updated',
					`Document request ${requestId} updated`,
					user,
					{
						request_id: requestId,
						document_type: existingRequest.document_type,
						old_status: oldStatus,
						new_status: status || oldStatus,
						student_name: existingRequest.full_name,
						student_id: existingRequest.account_number,
						old_payment_status: oldPaymentStatus,
						new_payment_status: updateData.payment_status || existingRequest.payment_status,
						payment_status_changed: paymentStatusChanged,
						status_changed: statusChanged
					}
				);

				return json({ success: true, message: 'Request updated successfully' });

			case 'reject':
				// Admin and teachers can reject requests
				if (user.account_type !== 'admin' && user.account_type !== 'teacher') {
					return json({ error: 'Permission denied' }, { status: 403 });
				}

				const rejectRequestId = data.requestId;
				if (!rejectRequestId) {
					return json({ error: 'Request ID is required' }, { status: 400 });
				}

				// Get the request before rejecting to access student_id and document_type
				const requestToReject = await db
					.collection('document_requests')
					.findOne({ request_id: rejectRequestId });

				if (!requestToReject) {
					return json({ error: 'Request not found' }, { status: 404 });
				}

				const rejectResult = await db
					.collection('document_requests')
					.updateOne(
						{ request_id: rejectRequestId },
						{
							$set: {
								status: 'rejected',
								tentative_date: null,
								processed_by: user.name,
								processed_by_id: user.id,
								updated_at: new Date()
							},
							$push: {
								status_history: {
									status: 'rejected',
									timestamp: new Date(),
									changedBy: user.name || user.full_name || 'Admin',
									note: 'Request has been rejected. Please contact the office for more information.'
								}
							}
						}
					);

				if (rejectResult.matchedCount === 0) {
					return json({ error: 'Request not found' }, { status: 404 });
				}

				// Send automated message to document request thread
				await sendAutomatedStatusMessage(
					db,
					rejectRequestId,
					'rejected',
					user.name || user.full_name
				);

				// Notify student about rejection
				await createDocumentRequestNotification(db, requestToReject.student_id, {
					title: `Document Request Rejected`,
					message: `Your request for "${requestToReject.document_type}" (${rejectRequestId}) has been rejected by ${user.name}. Please contact the office for more information.`,
					priority: 'high',
					requestId: rejectRequestId,
					documentType: requestToReject.document_type,
					status: 'rejected',
					adminName: user.name,
					adminId: user.id
				});

				// Log activity with detailed information
				await logActivityWithUser(
					'document_request_rejected',
					`Document request ${rejectRequestId} rejected`,
					user,
					{
						request_id: rejectRequestId,
						document_type: requestToReject.document_type,
						student_name: requestToReject.full_name,
						student_id: requestToReject.account_number,
						old_status: requestToReject.status
					}
				);

				return json({ success: true, message: 'Request rejected successfully' });

			case 'cancel':
				// Students can cancel their own pending requests
				const cancelRequestId = data.requestId;
				if (!cancelRequestId) {
					return json({ error: 'Request ID is required' }, { status: 400 });
				}

				// Find the request first to verify ownership
				const requestToCancel = await db
					.collection('document_requests')
					.findOne({ request_id: cancelRequestId });

				if (!requestToCancel) {
					return json({ error: 'Request not found' }, { status: 404 });
				}

				// Check if student owns this request
				if (requestToCancel.student_id !== user.id) {
					return json({ error: 'You can only cancel your own requests' }, { status: 403 });
				}

				// Check if request can be cancelled (only on_hold status)
				if (requestToCancel.status !== 'on_hold') {
					return json({ error: 'Only pending requests can be cancelled' }, { status: 400 });
				}

				const cancelResult = await db
					.collection('document_requests')
					.updateOne(
						{ request_id: cancelRequestId },
						{
							$set: {
								status: 'cancelled',
								cancelled_date: new Date(),
								updated_at: new Date()
							},
							$push: {
								status_history: {
									status: 'cancelled',
									timestamp: new Date(),
									changedBy: user.name || user.full_name || 'Student',
									note: 'Student cancelled the request. You may submit a new request if needed.'
								}
							}
						}
					);

				if (cancelResult.matchedCount === 0) {
					return json({ error: 'Request not found' }, { status: 404 });
				}

				// Log activity
				await logActivityWithUser(
					'document_request_cancelled',
					`Document request ${cancelRequestId} cancelled by student`,
					user
				);

				return json({ success: true, message: 'Request cancelled successfully' });

			case 'markAsRead':
				// Students can mark messages as read for their own requests
				const markReadRequestId = data.requestId;
				
				if (!markReadRequestId) {
					return json({ error: 'Request ID is required' }, { status: 400 });
				}

				// Find the request
				const requestToMarkRead = await db
					.collection('document_requests')
					.findOne({ request_id: markReadRequestId });

				if (!requestToMarkRead) {
					return json({ error: 'Request not found' }, { status: 404 });
				}

				// For students, verify they own the request
				if (user.account_type === 'student' && requestToMarkRead.student_id !== user.id) {
					return json({ error: 'You can only mark your own requests as read' }, { status: 403 });
				}

				// Update last_read_at timestamp
				const markReadResult = await db
					.collection('document_requests')
					.updateOne(
						{ request_id: markReadRequestId },
						{
							$set: {
								last_read_at: new Date(),
								updated_at: new Date()
							}
						}
					);

				if (markReadResult.matchedCount === 0) {
					return json({ error: 'Failed to mark as read' }, { status: 500 });
				}

				return json({ 
					success: true, 
					message: 'Messages marked as read',
					data: { lastReadAt: new Date() }
				});

		case 'sendMessage':
			// Both students and admins can send messages
			const msgRequestId = data.requestId;
			const messageText = data.message || '';
			const attachments = data.attachments || [];

			if (!msgRequestId || (!messageText && attachments.length === 0)) {
				return json({ error: 'Request ID and message or attachments are required' }, { status: 400 });
			}

			// Find the request
			const targetRequest = await db
				.collection('document_requests')
				.findOne({ request_id: msgRequestId });

			if (!targetRequest) {
				return json({ error: 'Request not found' }, { status: 404 });
			}

			// For students, verify they own the request
			if (user.account_type === 'student' && targetRequest.student_id !== user.id) {
				return json({ error: 'You can only send messages to your own requests' }, { status: 403 });
			}

			// Encrypt the message text before storing (if present)
			const encryptedText = messageText ? encryptMessage(messageText.trim()) : '';

			// Create the message object with encrypted text and attachments
			const newMessage = {
				id: new ObjectId().toString(),
				author: user.name || user.full_name,
				authorId: user.id,
				authorRole: user.account_type,
				text: encryptedText,
				attachments: attachments, // Store attachments (already base64 encoded from client)
				created_at: new Date()
			};

			// Add message to the document request
			const messageResult = await db
				.collection('document_requests')
				.updateOne(
					{ request_id: msgRequestId },
					{
						$push: { messages: newMessage },
						$set: { updated_at: new Date() }
					}
				);

			if (messageResult.matchedCount === 0) {
				return json({ error: 'Failed to send message' }, { status: 500 });
			}

			// 3. Notify student when admin/teacher sends a message
			if (user.account_type === 'admin' || user.account_type === 'teacher') {
				let notificationMessage = '';
				
				// Handle different message scenarios
				if (messageText && attachments.length > 0) {
					// Both text and attachments
					const truncatedText = messageText.length > 80 
						? messageText.substring(0, 80) + '...' 
						: messageText;
					notificationMessage = `${truncatedText} (+ ${attachments.length} file${attachments.length > 1 ? 's' : ''})`;
				} else if (messageText) {
					// Only text
					notificationMessage = messageText.length > 100 
						? messageText.substring(0, 100) + '...' 
						: messageText;
				} else if (attachments.length > 0) {
					// Only attachments
					notificationMessage = `Sent ${attachments.length} file${attachments.length > 1 ? 's' : ''}`;
				}
				
				await createDocumentRequestNotification(db, targetRequest.student_id, {
					title: `New Message from ${user.name}`,
					message: `You have a new message regarding your "${targetRequest.document_type}" request (${msgRequestId}): ${notificationMessage}`,
					priority: 'normal',
					requestId: msgRequestId,
					documentType: targetRequest.document_type,
					status: targetRequest.status,
					adminName: user.name,
					adminId: user.id
				});
			}

				// Return the message with decrypted text for the response
				return json({
					success: true,
					message: 'Message sent successfully',
					data: {
						...newMessage,
						text: messageText.trim() // Return plaintext in response
					}
				});

			default:
				return json({ error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		console.error('Error in /api/document-requests POST:', error);
		return json({ error: 'Failed to process request' }, { status: 500 });
	}
}

// Helper function to format date for display (MM/DD/YYYY)
function formatDate(dateString) {
	if (!dateString) return 'N/A';
	const date = new Date(dateString);
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const year = date.getFullYear();
	return `${month}/${day}/${year}`;
}

// Helper function to format date for input (YYYY-MM-DD)
function formatDateForInput(dateString) {
	if (!dateString) return null;
	const date = new Date(dateString);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

// Helper function to format date of birth for display (Month DD, YYYY)
function formatDateDisplay(dateString) {
	if (!dateString) return 'N/A';
	const date = new Date(dateString);
	const options = { year: 'numeric', month: 'long', day: 'numeric' };
	return date.toLocaleDateString('en-US', options);
}

// Helper function to format date for receipt (Month DD, YYYY)
function formatReceiptDate(dateString) {
	if (!dateString) return 'N/A';
	const date = new Date(dateString);
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 
		'July', 'August', 'September', 'October', 'November', 'December'];
	return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Generate PDF receipt
async function generateReceiptPDF(request) {
	return new Promise((resolve, reject) => {
		try {
			const doc = new PDFDocument({ 
				size: 'LEGAL',
				margins: { top: 50, bottom: 50, left: 50, right: 50 }
			});

			const chunks = [];
			doc.on('data', chunk => chunks.push(chunk));
			doc.on('end', () => resolve(Buffer.concat(chunks)));
			doc.on('error', reject);

			// Colors
			const lightGray = '#F5F5F5';
			const lightGreen = '#E8F5E9';
			const lightBlue = '#E3F2FD';
			const darkGray = '#424242';
			const black = '#000000';

			// Page width and starting position
			const pageWidth = 612; // Letter size width in points
			const margin = 50;
			const contentWidth = pageWidth - (margin * 2);
			let yPos = margin;

			// Header: "For Cashier Processing"
			doc.fontSize(14)
				.fillColor(darkGray)
				.text('For Cashier Processing', 0, yPos, { align: 'center', width: pageWidth });
			yPos += 25;

			// Status badge: "Ready for Pick Up"
			const statusText = 'Ready for Pick Up';
			const statusWidth = doc.widthOfString(statusText, { fontSize: 12 });
			const statusX = (pageWidth - statusWidth) / 2 - 20;
			doc.roundedRect(statusX, yPos, statusWidth + 40, 25, 5)
				.fill(lightGreen);
			doc.fontSize(12)
				.fillColor('#2E7D32')
				.text(statusText, statusX + 28, yPos + 7, { width: statusWidth });
			yPos += 40;

			// Dashed line
			doc.moveTo(margin, yPos)
				.lineTo(pageWidth - margin, yPos)
				.dash(5, { space: 5 })
				.strokeColor(black)
				.stroke();
			doc.undash();
			yPos += 20;

			// Receipt Number
			doc.fontSize(10)
				.fillColor(darkGray)
				.text('Receipt Number', 0, yPos, { align: 'center', width: pageWidth });
			doc.fontSize(18)
				.fillColor(black)
				.font('Helvetica-Bold')
				.text(request.request_id, 0, yPos + 15, { align: 'center', width: pageWidth });
			yPos += 50;

			// Student Information Section
			const studentInfoY = yPos;
			const studentInfoHeight = 120;
			doc.roundedRect(margin, studentInfoY, contentWidth, studentInfoHeight, 8)
				.fill(lightGray);
			
			doc.fontSize(12)
				.fillColor(darkGray)
				.font('Helvetica-Bold')
				.text('Student Information', margin + 15, studentInfoY + 15);
			
			// Horizontal line under title
			doc.moveTo(margin + 15, studentInfoY + 35)
				.lineTo(pageWidth - margin - 15, studentInfoY + 35)
				.strokeColor(black)
				.stroke();
			
			// Student details
			const leftColX = margin + 15;
			const rightColX = pageWidth / 2 + 20;
			const detailY = studentInfoY + 50;

			doc.fontSize(10)
				.fillColor(darkGray)
				.font('Helvetica')
				.text('Student ID', leftColX, detailY);
			doc.fontSize(11)
				.fillColor(black)
				.font('Helvetica-Bold')
				.text(request.account_number || 'N/A', leftColX, detailY + 15);

			doc.fontSize(10)
				.fillColor(darkGray)
				.font('Helvetica')
				.text('Grade & Section', leftColX, detailY + 35);
			doc.fontSize(11)
				.fillColor(black)
				.font('Helvetica-Bold')
				.text(`Grade ${request.grade_level}${request.section ? '-' + request.section : ''}`, leftColX, detailY + 50);

			doc.fontSize(10)
				.fillColor(darkGray)
				.font('Helvetica')
				.text('Full Name', rightColX, detailY);
			doc.fontSize(11)
				.fillColor(black)
				.font('Helvetica-Bold')
				.text(request.full_name || 'N/A', rightColX, detailY + 15);

			yPos = studentInfoY + studentInfoHeight + 20;

			// Document Details Section
			const docDetailsY = yPos;
			doc.roundedRect(margin, docDetailsY, contentWidth, 120, 8)
				.fill(lightGray);
			
			doc.fontSize(12)
				.fillColor(darkGray)
				.font('Helvetica-Bold')
				.text('Document Details', margin + 15, docDetailsY + 15);
			
			// Horizontal line under title
			doc.moveTo(margin + 15, docDetailsY + 35)
				.lineTo(pageWidth - margin - 15, docDetailsY + 35)
				.strokeColor(black)
				.stroke();
			
			// Document details
			const docDetailY = docDetailsY + 50;

			doc.fontSize(10)
				.fillColor(darkGray)
				.font('Helvetica')
				.text('Document Type', leftColX, docDetailY);
			doc.fontSize(11)
				.fillColor(black)
				.font('Helvetica-Bold')
				.text(request.document_type || 'N/A', leftColX, docDetailY + 15);

			doc.fontSize(10)
				.fillColor(darkGray)
				.font('Helvetica')
				.text('Processed By', leftColX, docDetailY + 35);
			doc.fontSize(11)
				.fillColor(black)
				.font('Helvetica-Bold')
				.text(request.processed_by || 'N/A', leftColX, docDetailY + 50);

			doc.fontSize(10)
				.fillColor(darkGray)
				.font('Helvetica')
				.text('Request Date', rightColX, docDetailY);
			doc.fontSize(11)
				.fillColor(black)
				.font('Helvetica-Bold')
				.text(formatReceiptDate(request.submitted_date), rightColX, docDetailY + 15);

			doc.fontSize(10)
				.fillColor(darkGray)
				.font('Helvetica')
				.text('Pick Up Date', rightColX, docDetailY + 35);
			const pickupDate = request.tentative_date ? formatReceiptDate(request.tentative_date) : formatReceiptDate(new Date());
			doc.fontSize(11)
				.fillColor(black)
				.font('Helvetica-Bold')
				.text(pickupDate, rightColX, docDetailY + 50);

			yPos = docDetailsY + 120 + 20;

			// Fee Breakdown
			const documentFee = request.payment_amount || 0;
			const processingFee = 0;
			const totalAmount = documentFee + processingFee;

			doc.fontSize(11)
				.fillColor(black)
				.font('Helvetica')
				.text('Document Fee:', margin, yPos);
			doc.text(`P${documentFee.toFixed(2)}`, pageWidth - margin - 100, yPos, { width: 100, align: 'right' });
			yPos += 20;

			doc.text('Processing Fee:', margin, yPos);
			doc.text(`P${processingFee.toFixed(2)}`, pageWidth - margin - 100, yPos, { width: 100, align: 'right' });
			yPos += 25;

			// Horizontal line
			doc.moveTo(margin, yPos)
				.lineTo(pageWidth - margin, yPos)
				.strokeColor(black)
				.stroke();
			yPos += 15;

			doc.fontSize(12)
				.fillColor(black)
				.font('Helvetica-Bold')
				.text('Total Amount', margin, yPos);
			doc.text(`P${totalAmount.toFixed(2)}`, pageWidth - margin - 100, yPos, { width: 100, align: 'right' });
			yPos += 40;

			// Payment Status badge
			const statusBoxWidth = 150;
			const statusBoxHeight = 55;
			const statusBoxX = (pageWidth - statusBoxWidth) / 2;
			const statusBoxY = yPos;
			
			// Light brown/beige background
			doc.roundedRect(statusBoxX, statusBoxY, statusBoxWidth, statusBoxHeight, 5)
				.fill('#D7CCC8');
			
			// Border
			doc.roundedRect(statusBoxX, statusBoxY, statusBoxWidth, statusBoxHeight, 5)
				.strokeColor('#8D6E63')
				.lineWidth(1)
				.stroke();
			
			// "Payment Status" label
			doc.fontSize(10)
				.fillColor(darkGray)
				.font('Helvetica-Bold')
				.text('Payment Status', statusBoxX + 10, statusBoxY + 10, { width: statusBoxWidth - 20, align: 'center' });
			
			// Horizontal line under label
			doc.moveTo(statusBoxX + 10, statusBoxY + 45)
				.lineTo(statusBoxX + statusBoxWidth - 10, statusBoxY + 45)
				.strokeColor('#8D6E63')
				.stroke();
			
			yPos += statusBoxHeight + 30;

			// Instructions for Cashier
			const instructionsY = yPos;
			doc.roundedRect(margin, instructionsY, contentWidth, 120, 8)
				.fill(lightBlue);
			
			// Blue vertical line on left
			doc.rect(margin, instructionsY, 5, 120)
				.fill('#2196F3');
			
			doc.fontSize(12)
				.fillColor(darkGray)
				.font('Helvetica-Bold')
				.text('Instructions for Cashier:', margin + 20, instructionsY + 15);
			
			const instructions = [
				'Verify student ID matches the name on this receipt',
				'Confirm payment status before releasing document',
				'Have student sign the release form',
				'Stamp this receipt as "RELEASED" after document handover',
				'File this receipt in the completed transactions folder'
			];

			let instructionY = instructionsY + 40;
			doc.fontSize(10)
				.fillColor(black)
				.font('Helvetica');
			
			instructions.forEach((instruction, index) => {
				doc.text(`${index + 1}. ${instruction}`, margin + 20, instructionY);
				instructionY += 15;
			});

			yPos = instructionsY + 120 + 30;

			// Signature Lines
			const signatureY = yPos + 10;
			const signatureWidth = (contentWidth - 40) / 2;

			// Student Signature
			doc.moveTo(margin, signatureY)
				.lineTo(margin + signatureWidth, signatureY)
				.strokeColor(black)
				.stroke();
			doc.fontSize(10)
				.fillColor(darkGray)
				.font('Helvetica')
				.text('Student Signature', margin, signatureY + 5);

			// Cashier Signature
			doc.moveTo(margin + signatureWidth + 40, signatureY)
				.lineTo(pageWidth - margin, signatureY)
				.strokeColor(black)
				.stroke();
			doc.text('Cashier Signature', margin + signatureWidth + 40, signatureY + 5);

			// Finalize PDF
			doc.end();
		} catch (error) {
			reject(error);
		}
	});
}

