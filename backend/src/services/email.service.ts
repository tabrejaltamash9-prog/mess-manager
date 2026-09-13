import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

/**
 * Send an OTP email to a student or staff member.
 */
export async function sendOtpEmail(
  toEmail: string,
  toName: string,
  otp: string
): Promise<void> {
  const expiryMinutes = env.OTP_EXPIRY_MINUTES;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a56db,#0e9f6e);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">🍽️ Mess QR System</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">College Mess Attendance</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi <strong>${toName}</strong>,</p>
              <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6;">
                Your one-time login code for the Mess QR app is:
              </p>
              <!-- OTP Box -->
              <div style="background:#f0fdf4;border:2px solid #0e9f6e;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#065f46;font-family:monospace;">
                  ${otp}
                </span>
              </div>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-align:center;">
                ⏱️ This code expires in <strong>${expiryMinutes} minutes</strong>.
              </p>
              <p style="margin:0;color:#6b7280;font-size:13px;text-align:center;">
                Do not share this code with anyone.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                If you did not request this code, please ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"${env.EMAIL_FROM_NAME}" <${env.GMAIL_USER}>`,
    to: toEmail,
    subject: `${otp} — Your Mess QR Login Code`,
    text: `Your Mess QR login code is: ${otp}\n\nThis code expires in ${expiryMinutes} minutes. Do not share it.`,
    html: htmlBody,
  });
}
