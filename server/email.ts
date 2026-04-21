import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const FROM_EMAIL = process.env.FROM_EMAIL || "xtrawordinary <noreply@xtrawordinary.app>";
const APP_URL = process.env.APP_URL || "http://localhost:5000";

export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  if (!resend) {
    console.log(`[Email] No RESEND_API_KEY set. Verification email for ${to}:`);
    console.log(`[Email] Verify URL: ${verifyUrl}`);
    return true;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Verify your xtrawordinary email",
      html: `
        <h2>Welcome to xtrawordinary!</h2>
        <p>Click the link below to verify your email address:</p>
        <p><a href="${verifyUrl}">Verify Email</a></p>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't create an account, you can ignore this email.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error("[Email] Failed to send verification email:", error);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  if (!resend) {
    console.log(`[Email] No RESEND_API_KEY set. Password reset email for ${to}:`);
    console.log(`[Email] Reset URL: ${resetUrl}`);
    return true;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Reset your xtrawordinary password",
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, you can ignore this email.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error("[Email] Failed to send password reset email:", error);
    return false;
  }
}
