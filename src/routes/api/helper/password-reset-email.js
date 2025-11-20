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
 * Send password reset email with verification code
 * @param {Object} resetData - Password reset information
 * @param {string} resetData.email - User's email address
 * @param {string} resetData.fullName - User's full name
 * @param {string} resetData.resetCode - 6-digit verification code
 * @param {string} resetData.accountNumber - User's account number
 * @returns {Promise<Object>} Result of the email sending operation
 */
export async function sendPasswordResetEmail(resetData) {
  try {
    const { email, fullName, resetCode, accountNumber } = resetData;

    if (!email) {
      throw new Error('Email address is required');
    }

    // Email HTML template - Styled to match SET-2 System Material Design 3
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - SET-2 System</title>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
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
          
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
          }
          
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
          
          .header-icon {
            width: 64px;
            height: 64px;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            font-size: 32px;
            backdrop-filter: blur(10px);
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
          
          .reset-code-box {
            background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
            border-radius: 12px;
            padding: 32px 24px;
            margin: 24px 0;
            border: 2px solid #4caf50;
            text-align: center;
          }
          
          .reset-code-box h2 {
            color: #2e7d32;
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 20px 0;
          }
          
          .reset-code {
            display: inline-block;
            background-color: #ffffff;
            border: 2px solid #4caf50;
            border-radius: 12px;
            padding: 20px 32px;
            font-size: 36px;
            font-weight: 700;
            color: #2e7d32;
            font-family: 'Courier New', 'Roboto Mono', monospace;
            letter-spacing: 8px;
            margin: 16px 0;
            box-shadow: 0 2px 8px rgba(76, 175, 80, 0.2);
          }
          
          .expiry-notice {
            background-color: #fff3e0;
            border: 1px solid #ff9800;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
            text-align: center;
          }
          
          .expiry-notice p {
            color: #f57c00;
            font-size: 14px;
            margin: 0;
            font-weight: 500;
          }
          
          .security-notice {
            background-color: #ffebee;
            border: 1px solid #f44336;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
          }
          
          .security-notice h3 {
            color: #c62828;
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
          }
          
          .security-notice p {
            color: #c62828;
            font-size: 14px;
            margin: 8px 0;
            line-height: 1.5;
          }
          
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
            
            .reset-code-box {
              padding: 24px 16px;
            }
            
            .reset-code {
              font-size: 28px;
              letter-spacing: 4px;
              padding: 16px 24px;
            }
            
            .footer {
              padding: 20px 24px;
            }
            
            .header h1 {
              font-size: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <!-- Header -->
          <div class="header">
            <div class="header-content">
              <h1>Password Reset Request</h1>
              <p>SET-2 System Security</p>
            </div>
          </div>
          
          <!-- Content -->
          <div class="content">
            <p class="greeting">Hello, <strong>${fullName}</strong></p>
            
            <p class="intro-text">
              We received a request to reset the password for your SET-2 System account 
              (<strong>${accountNumber}</strong>). Use the verification code below to proceed with your password reset.
            </p>
            
            <!-- Reset Code Box -->
            <div class="reset-code-box">
              <h2>Your Verification Code</h2>
              <div class="reset-code">${resetCode}</div>
              <p style="color: #2e7d32; font-size: 14px; margin: 0;">
                Enter this code on the password reset page to continue.
              </p>
            </div>
            
            <!-- Expiry Notice -->
            <div class="expiry-notice">
              <p>⏰ This verification code will expire in <strong>15 minutes</strong> for security reasons.</p>
            </div>
            
            <!-- Security Notice -->
            <div class="security-notice">
              <h3>⚠️ Security Alert</h3>
              <p>
                If you did not request this password reset, please ignore this email and 
                contact your system administrator immediately.
              </p>
              <p>
                Your account security is important to us. Never share your verification 
                code with anyone.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>This is an automated security message from the SET-2 System.</p>
            <p>Please do not reply to this email.</p>
            <p>For assistance, please contact your system administrator.</p>
            <p class="footer-brand">© ${new Date().getFullYear()} SET-2 System • All rights reserved</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const textContent = `
╔══════════════════════════════════════════════════════════════╗
║            PASSWORD RESET REQUEST - SET-2 SYSTEM             ║
╚══════════════════════════════════════════════════════════════╝

Hello ${fullName},

We received a request to reset the password for your SET-2 System 
account (${accountNumber}).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 YOUR VERIFICATION CODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                        ${resetCode}

⏰ This code expires in 15 minutes for security reasons.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 HOW TO RESET YOUR PASSWORD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Return to the password reset page
2. Enter the 6-digit verification code shown above
3. Create a new, secure password
4. Confirm your new password
5. Click "Reset Password" to complete the process

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  SECURITY ALERT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If you did not request this password reset, please ignore this 
email and contact your system administrator immediately.

Your account security is important to us. Never share your 
verification code with anyone.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated security message from the SET-2 System.
Please do not reply to this email.

For assistance, please contact your system administrator.

© ${new Date().getFullYear()} SET-2 System. All rights reserved.
    `.trim();

    // Prepare email data for Brevo API
    const emailData = {
      sender: {
        name: 'SET-2 System Security',
        email: process.env.BREVO_FROM_EMAIL || process.env.SMTP_FROM_EMAIL
      },
      to: [{ email: email }],
      subject: 'Password Reset Request - SET-2 System',
      htmlContent: htmlContent,
      textContent: textContent
    };

    // Send email using Brevo API
    const result = await sendEmailViaBrevoAPI(emailData);

    if (result.success) {
      console.log('Password reset email sent successfully:', result.messageId);
    }

    return result;

  } catch (error) {
    console.error('Error sending password reset email:', error);
    
    return {
      success: false,
      error: error.message
    };
  }
}