import nodemailer from 'nodemailer';

// Contact form messages are always stored (Admin > Messages). If SMTP is configured they are also emailed.
export function createMailer(config) {
  if (!config.smtpHost || !config.contactTo) return null;
  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
  });
  return {
    async sendContact(msg, siteName = 'Website') {
      await transport.sendMail({
        from: config.mailFrom,
        to: config.contactTo,
        replyTo: { name: msg.name, address: msg.email },
        subject: `${siteName} enquiry: ${msg.topic || 'General'} from ${msg.name}`,
        text: `Name: ${msg.name}\nEmail: ${msg.email}\nTopic: ${msg.topic || '-'}\n\n${msg.message}\n`,
      });
    },
  };
}
