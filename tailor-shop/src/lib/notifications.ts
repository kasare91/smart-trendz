import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import { getDueDateUrgency, calculateDaysToDue, formatDate, formatCurrency } from './utils';
import { DEFAULT_BUSINESS_NAME, getBusinessProfile } from './business-profile';

// Initialize SendGrid (if API key is provided)
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Initialize Nodemailer (fallback for development)
// Only create transporter if SMTP credentials are configured
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  } : undefined,
});

export type WhatsAppReceiptParams = {
  to: string;
  customerName: string;
  orderNumber: string;
  description: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  dueDate: Date;
  businessName: string;
  receiptFooter?: string;
};

function toE164Ghana(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+233${digits.slice(1)}`;
  if (digits.length === 9) return `+233${digits}`;
  return `+${digits}`;
}

/**
 * Send WhatsApp order receipt using Twilio
 */
export async function sendWhatsAppReceipt(
  params: WhatsAppReceiptParams
): Promise<string> {
  if (process.env.ENABLE_WHATSAPP_NOTIFICATIONS !== 'true') {
    throw new Error('WhatsApp notifications disabled');
  }

  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_WHATSAPP_NUMBER
  ) {
    throw new Error('Twilio WhatsApp credentials not configured');
  }

  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const messageBody = [
      `*${params.businessName}*`,
      `Hi ${params.customerName}, here is your receipt.`,
      '',
      `Order: ${params.orderNumber}`,
      `Item: ${params.description}`,
      `Due: ${formatDate(params.dueDate)}`,
      '',
      `Total:    GHS ${params.totalAmount.toFixed(2)}`,
      `Paid:     GHS ${params.amountPaid.toFixed(2)}`,
      `Balance:  GHS ${params.balance.toFixed(2)}`,
      '',
      params.receiptFooter || '',
      'Thank you for your business!',
    ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '').join('\n');

    const normalizedTo = toE164Ghana(params.to);
    const message = await client.messages.create({
      body: messageBody,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: normalizedTo.startsWith('whatsapp:') ? normalizedTo : `whatsapp:${normalizedTo}`,
    });

    console.log(`WhatsApp receipt sent for order ${params.orderNumber}`);
    return message.sid;
  } catch (error) {
    console.error('Error sending WhatsApp receipt:', error);
    throw error;
  }
}

/**
 * Send SMS reminder using Twilio
 */
export async function sendSMSReminder(
  phoneNumber: string,
  orderNumber: string,
  dueDate: Date,
  customerName: string,
  businessName = DEFAULT_BUSINESS_NAME
): Promise<boolean> {
  if (process.env.ENABLE_SMS_NOTIFICATIONS !== 'true') {
    console.log('SMS notifications disabled');
    return false;
  }

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('Twilio credentials not configured');
    return false;
  }

  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const days = calculateDaysToDue(dueDate);
    const urgency = getDueDateUrgency(dueDate);

    let message = '';
    if (urgency === 'overdue') {
      message = `Hi ${customerName}, your order ${orderNumber} is OVERDUE. Please collect it from ${businessName}. Thank you!`;
    } else if (urgency === 'warning-1') {
      message = `Hi ${customerName}, reminder: Order ${orderNumber} is due TOMORROW at ${businessName}. Thank you!`;
    } else if (urgency === 'warning-3') {
      message = `Hi ${customerName}, your order ${orderNumber} will be ready in ${days} days at ${businessName}.`;
    } else if (urgency === 'warning-5') {
      message = `Hi ${customerName}, reminder: Order ${orderNumber} is due in ${days} days. ${businessName}.`;
    } else {
      return false; // Don't send for 'safe' orders
    }

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log(`SMS sent to ${phoneNumber} for order ${orderNumber}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

/**
 * Send SMS payment confirmation using Twilio
 */
export async function sendPaymentConfirmationSMS(
  phoneNumber: string,
  customerName: string,
  orderNumber: string,
  amountPaid: number,
  newBalance: number,
  businessName = DEFAULT_BUSINESS_NAME
): Promise<boolean> {
  if (process.env.ENABLE_SMS_NOTIFICATIONS !== 'true') {
    console.log('SMS notifications disabled');
    return false;
  }

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('Twilio credentials not configured');
    return false;
  }

  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const message = newBalance > 0
      ? `Hi ${customerName}, payment of GHS ${amountPaid.toFixed(2)} received for order ${orderNumber}. Balance: GHS ${newBalance.toFixed(2)}. Thank you! - ${businessName}`
      : `Hi ${customerName}, payment of GHS ${amountPaid.toFixed(2)} received for order ${orderNumber}. Fully paid! Thank you! - ${businessName}`;

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log(`Payment confirmation SMS sent to ${phoneNumber} for order ${orderNumber}`);
    return true;
  } catch (error) {
    console.error('Error sending payment confirmation SMS:', error);
    return false;
  }
}

/**
 * Send email reminder using SendGrid or Nodemailer
 */
export async function sendEmailReminder(
  email: string,
  orderNumber: string,
  dueDate: Date,
  customerName: string,
  orderDescription: string,
  balance: number,
  businessName = DEFAULT_BUSINESS_NAME
): Promise<boolean> {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
    console.log('Email notifications disabled');
    return false;
  }

  const days = calculateDaysToDue(dueDate);
  const urgency = getDueDateUrgency(dueDate);

  if (urgency === 'safe') {
    return false; // Don't send for safe orders
  }

  let subject = '';
  let html = '';
  const formattedDueDate = formatDate(dueDate);
  const formattedBalance = formatCurrency(balance);

  if (urgency === 'overdue') {
    subject = `Order ${orderNumber} is Overdue - ${businessName}`;
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .alert { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${businessName}</h1>
            <p style="margin: 10px 0 0 0;">Order Reminder</p>
          </div>
          <div class="content">
            <div class="alert">
              <strong>⚠️ Order Overdue</strong>
            </div>
            <p>Dear ${customerName},</p>
            <p>Your order is now <strong>overdue</strong>. Please visit ${businessName} to collect it at your earliest convenience.</p>
            <div class="order-details">
              <p><strong>Order Number:</strong> ${orderNumber}</p>
              <p><strong>Description:</strong> ${orderDescription}</p>
              <p><strong>Due Date:</strong> ${formattedDueDate}</p>
              <p><strong>Outstanding Balance:</strong> <span style="color: #f59e0b; font-size: 18px; font-weight: bold;">${formattedBalance}</span></p>
            </div>
            <p>Thank you for choosing ${businessName}!</p>
            <div class="footer">
              <p>${businessName}<br>This is an automated reminder.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  } else if (urgency === 'warning-1') {
    subject = `Order ${orderNumber} Due Tomorrow - ${businessName}`;
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${businessName}</h1>
            <p style="margin: 10px 0 0 0;">Order Reminder</p>
          </div>
          <div class="content">
            <div class="alert">
              <strong>⏰ Order Due Tomorrow</strong>
            </div>
            <p>Dear ${customerName},</p>
            <p>This is a friendly reminder that your order will be <strong>due tomorrow</strong>.</p>
            <div class="order-details">
              <p><strong>Order Number:</strong> ${orderNumber}</p>
              <p><strong>Description:</strong> ${orderDescription}</p>
              <p><strong>Due Date:</strong> ${formattedDueDate}</p>
              <p><strong>Outstanding Balance:</strong> <span style="color: #f59e0b; font-size: 18px; font-weight: bold;">${formattedBalance}</span></p>
            </div>
            <p>We look forward to seeing you at ${businessName}!</p>
            <div class="footer">
              <p>${businessName}<br>This is an automated reminder.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  } else {
    subject = `Order ${orderNumber} Due in ${days} Days - ${businessName}`;
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${businessName}</h1>
            <p style="margin: 10px 0 0 0;">Order Reminder</p>
          </div>
          <div class="content">
            <p>Dear ${customerName},</p>
            <p>This is a friendly reminder about your upcoming order.</p>
            <div class="order-details">
              <p><strong>Order Number:</strong> ${orderNumber}</p>
              <p><strong>Description:</strong> ${orderDescription}</p>
              <p><strong>Due Date:</strong> ${formattedDueDate} <span style="color: #0ea5e9;">(${days} days from now)</span></p>
              <p><strong>Outstanding Balance:</strong> <span style="color: #f59e0b; font-size: 18px; font-weight: bold;">${formattedBalance}</span></p>
            </div>
            <p>Thank you for choosing ${businessName}!</p>
            <div class="footer">
              <p>${businessName}<br>This is an automated reminder.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  try {
    // Try SendGrid first
    if (process.env.SENDGRID_API_KEY && process.env.FROM_EMAIL) {
      await sgMail.send({
        to: email,
        from: process.env.FROM_EMAIL,
        subject,
        html,
      });
      console.log(`Email sent via SendGrid to ${email} for order ${orderNumber}`);
      return true;
    }

    // Fallback to Nodemailer
    if (process.env.SMTP_USER) {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: email,
        subject,
        html,
      });
      console.log(`Email sent via SMTP to ${email} for order ${orderNumber}`);
      return true;
    }

    console.log('No email service configured');
    return false;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Send combined notification (email + SMS)
 */
export async function sendOrderReminder(
  customer: { fullName: string; phoneNumber: string; email?: string | null },
  order: { orderNumber: string; description: string; dueDate: Date },
  balance: number
): Promise<{ email: boolean; sms: boolean }> {
  const businessProfile = await getBusinessProfile();
  const businessName = businessProfile?.businessName || DEFAULT_BUSINESS_NAME;
  const results = {
    email: false,
    sms: false,
  };

  // Send email if available
  if (customer.email) {
    results.email = await sendEmailReminder(
      customer.email,
      order.orderNumber,
      order.dueDate,
      customer.fullName,
      order.description,
      balance,
      businessName
    );
  }

  // Send SMS
  results.sms = await sendSMSReminder(
    customer.phoneNumber,
    order.orderNumber,
    order.dueDate,
    customer.fullName,
    businessName
  );

  return results;
}

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<boolean> {
  const businessProfile = await getBusinessProfile();
  const businessName = businessProfile?.businessName || DEFAULT_BUSINESS_NAME;
  const subject = `Reset your ${businessName} password`;
  const html = `
    <p>You requested a password reset for ${businessName}.</p>
    <p><a href="${resetLink}">Reset your password</a></p>
    <p>This link expires soon. If you did not request this, you can ignore this email.</p>
  `;

  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
    console.log(`Development password reset link for ${email}: ${resetLink}`);
    return true;
  }

  if (process.env.SENDGRID_API_KEY && process.env.FROM_EMAIL) {
    await sgMail.send({
      to: email,
      from: process.env.FROM_EMAIL,
      subject,
      html,
    });
    return true;
  }

  if (process.env.SMTP_USER) {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: email,
      subject,
      html,
    });
    return true;
  }

  console.warn('Password reset email requested, but no email service is configured');
  return false;
}
