import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Send email using Brevo API (HTTPS-based, works on Render)
 * @param {Object} emailData - Email configuration
 * @param {Object} emailData.sender - Sender information
 * @param {Array} emailData.to - Array of recipients
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.htmlContent - HTML content
 * @param {string} emailData.textContent - Plain text content
 * @returns {Promise<Object>} Result of the email sending operation
 */
async function sendEmailViaBrevoAPI(emailData) {
  try {
    const { sender, to, subject, htmlContent, textContent } = emailData;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: sender,
        to: to,
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent,
        headers: {
          'X-Mailer': 'SET-2 System v1.0',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Importance': 'Normal'
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Brevo API Error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Email sent successfully via Brevo API:', data.messageId);

    return {
      success: true,
      messageId: data.messageId,
      data: data
    };

  } catch (error) {
    console.error('Error sending email via Brevo API:', error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send account creation email to the user
 * @param {Object} accountData - Account information
 * @param {string} accountData.email - User's email address
 * @param {string} accountData.fullName - User's full name
 * @param {string} accountData.accountNumber - Account number (also used as password)
 * @param {string} accountData.accountType - Type of account (student, teacher, admin)
 * @returns {Promise<Object>} Result of the email sending operation
 */
export async function sendAccountCreationEmail(accountData) {
  try {
    const { email, fullName, accountNumber, accountType } = accountData;

    if (!email) {
      throw new Error('Email address is required');
    }

    const accountTypeLabel = 
      accountType === 'student' ? 'Student' :
      accountType === 'teacher' ? 'Teacher' : 'Admin';

    // Email HTML template - Styled to match SET-2 System Material Design 3
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Created - SET-2 System</title>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            /* Reset and Base Styles */
            * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1c1b1f;
            background-color: #f5f5f5;
            padding: 24px 16px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          /* Container */
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
          }
          
          /* Header Section */
          .header {
            background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
            color: #ffffff;
            padding: 40px 32px;
            text-align: center;
            position: relative;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at top right, rgba(3, 169, 244, 0.3) 0%, transparent 50%);
            pointer-events: none;
          }
          
          .header-content {
            position: relative;
            z-index: 1;
          }
          
          .header h1 {
            font-size: 28px;
            font-weight: 500;
            margin: 0 0 8px 0;
            color: #ffffff;
            letter-spacing: -0.5px;
          }
          
          .header p {
            font-size: 16px;
            margin: 0;
            opacity: 0.95;
            font-weight: 400;
          }
          
          /* Content Section */
          .content {
            padding: 32px;
          }
          
          .greeting {
            font-size: 18px;
            font-weight: 500;
            color: #1c1b1f;
            margin-bottom: 16px;
          }
          
          .intro-text {
            font-size: 16px;
            color: #49454f;
            margin-bottom: 24px;
            line-height: 1.6;
          }
          
          /* Credentials Box */
          .credentials-box {
            background: linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%);
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
            border: 1px solid #90caf9;
          }
          
          .credentials-box h2 {
            color: #0d47a1;
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 20px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .credential-item {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid #cac4d0;
            text-align: center;
          }
          
          .credential-item:last-child {
            margin-bottom: 0;
          }
          
          .credential-item:hover {
            border-color: #1565c0;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          }
          
          .credential-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #49454f;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 8px;
            text-align: center;
          }
          
          .credential-value {
            display: block;
            font-size: 20px;
            font-weight: 600;
            color: #1565c0;
            font-family: 'Courier New', 'Roboto Mono', monospace;
            letter-spacing: 0.5px;
            text-align: center;
          }
          
          /* Warning Box */
          .warning-box {
            background-color: #fff3e0;
            border: 1px solid #ff9800;
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
          }
          
          .warning-box h3 {
            color: #f57c00;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .warning-box p {
            color: #f57c00;
            font-size: 14px;
            margin: 8px 0;
            line-height: 1.5;
          }
          
          .warning-box strong {
            font-weight: 600;
          }
          
          /* Instructions Box */
          .instructions-box {
            background-color: #e3f2fd;
            border: 1px solid #1565c0;
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
          }
          
          .instructions-box h3 {
            color: #0d47a1;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 16px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .instructions-box ol {
            margin: 0;
            padding-left: 20px;
          }
          
          .instructions-box li {
            color: #1565c0;
            font-size: 14px;
            margin: 10px 0;
            line-height: 1.6;
          }
          
          .instructions-box li strong {
            font-weight: 600;
            color: #0d47a1;
          }
          
          /* Contact Box */
          .contact-box {
            background-color: #f8f8f8;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0 0 0;
            text-align: center;
          }
          
          .contact-box p {
            color: #49454f;
            font-size: 14px;
            margin: 0;
          }
          
          /* Footer */
          .footer {
            background-color: #fafafa;
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e0e0e0;
          }
          
          .footer p {
            color: #79747e;
            font-size: 12px;
            margin: 6px 0;
            line-height: 1.5;
          }
          
          .footer-brand {
            font-weight: 600;
            color: #1565c0;
            margin-top: 16px;
          }
          
          /* Responsive Design */
          @media only screen and (max-width: 600px) {
            body {
              padding: 12px 8px;
            }
            
            .header {
              padding: 32px 24px;
            }
            
            .content {
              padding: 24px;
            }
            
            .credentials-box,
            .warning-box,
            .instructions-box {
              padding: 16px;
            }
            
            .footer {
              padding: 20px 24px;
            }
            
            .header h1 {
              font-size: 24px;
            }
            
            .credential-value {
              font-size: 18px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <!-- Header -->
          <div class="header">
            <div class="header-content">
              <h1>Account Created Successfully!</h1>
              <p>Welcome to SET-2 System</p>
            </div>
          </div>
          
          <!-- Content -->
          <div class="content">
            <p class="greeting">Hello, <strong>${fullName}</strong></p>
            
            <p class="intro-text">
              Your <strong>${accountTypeLabel} Account</strong> has been successfully created in the SET-2 System. 
              You can now access the system using the credentials provided below.
            </p>
            
            <!-- Credentials Box -->
            <div class="credentials-box">
              <h2>Your Login Credentials</h2>
              
              <div class="credential-item">
                <span class="credential-label">Account Number</span>
                <span class="credential-value">${accountNumber}</span>
              </div>
              
              <div class="credential-item">
                <span class="credential-label">Password</span>
                <span class="credential-value">${accountNumber}</span>
              </div>

              <div class="credential-item">
                <span class="credential-label">Account Type</span>
                <span class="credential-value">${accountTypeLabel}</span>
              </div>
            </div>
            
            <!-- Security Warning -->
            <div class="warning-box">
              <h3>Important Security Notice</h3>
              <p>
                <strong>Your password is currently set to the same as your account number.</strong>
              </p>
              <p>
                For security reasons, we strongly recommend changing your password immediately after your first login.
              </p>
            </div>
            
            <!-- Login Instructions -->
            <div class="instructions-box">
              <h3>How to Access Your Account</h3>
              <ol>
                <li>Navigate to the SET-2 System login page</li>
                <li>Enter your <strong>Account Number</strong> in the username field</li>
                <li>Enter your <strong>Password</strong> (same as account number for now)</li>
                <li>Click the <strong>"Login"</strong> button to access your account</li>
                <li>Change your password immediately in your account settings</li>
              </ol>
            </div>
            
            <!-- Contact Information -->
            <div class="contact-box">
              <p>
                If you did not expect this email or have any questions, 
                please contact the system administrator immediately.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>This is an automated message from the SET-2 System.</p>
            <p>Please do not reply to this email.</p>
            <p>For assistance, please contact your system administrator.</p>
            <p class="footer-brand">© ${new Date().getFullYear()} SET-2 System • All rights reserved</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version for email clients that don't support HTML
    const textContent = `
╔══════════════════════════════════════════════════════════════╗
║          ACCOUNT CREATED SUCCESSFULLY - SET-2 SYSTEM         ║
╚══════════════════════════════════════════════════════════════╝

Hello ${fullName},

Welcome to the SET-2 System! Your ${accountTypeLabel} Account has been 
successfully created and is now ready to use.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 YOUR LOGIN CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACCOUNT NUMBER:  ${accountNumber}
PASSWORD:        ${accountNumber}
ACCOUNT TYPE:    ${accountTypeLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  IMPORTANT SECURITY NOTICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your password is currently set to the same as your account number.

For security reasons, we STRONGLY RECOMMEND changing your password 
immediately after your first login.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 HOW TO ACCESS YOUR ACCOUNT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Navigate to the SET-2 System login page
2. Enter your ACCOUNT NUMBER in the username field
3. Enter your PASSWORD (same as account number for now)
4. Click the "Login" button to access your account
5. Change your password immediately in your account settings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If you did not expect this email or have any questions, please 
contact the system administrator immediately.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated message from the SET-2 System.
Please do not reply to this email.

For assistance, please contact your system administrator.

© ${new Date().getFullYear()} SET-2 System. All rights reserved.
    `.trim();

    // Prepare email data for Brevo API
    const emailData = {
      sender: {
        name: 'SET-2 System',
        email: process.env.BREVO_FROM_EMAIL || process.env.SMTP_FROM_EMAIL
      },
      to: [{ email: email }],
      subject: 'Account Created Successfully - SET-2 System',
      htmlContent: htmlContent,
      textContent: textContent
    };

    // Send email using Brevo API
    const result = await sendEmailViaBrevoAPI(emailData);

    if (result.success) {
      console.log('Account creation email sent successfully:', result.messageId);
    }

    return result;

  } catch (error) {
    console.error('Error sending account creation email:', error);
    
    return {
      success: false,
      error: error.message
    };
  }
}