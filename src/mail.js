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
    // A message taken by the AI voice agent. There's no email address to reply to, so the phone number leads.
    async sendPhone(msg, siteName = 'Website') {
      const flags = [msg.urgency === 'urgent' && 'URGENT', msg.needsReview && 'please check'].filter(Boolean);
      await transport.sendMail({
        from: config.mailFrom,
        to: config.contactTo,
        subject: `${flags.length ? `[${flags.join(', ')}] ` : ''}${siteName} phone message: ${msg.topic || 'General'} from ${msg.name}`,
        text: [
          `Name: ${msg.name}`,
          `Phone: ${msg.phone || 'withheld'}`,
          `Topic: ${msg.topic || '-'}`,
          `Urgency: ${msg.urgency}`,
          msg.preferredTime && `Preferred time: ${msg.preferredTime}`,
          msg.needsReview && 'The assistant was unsure about some details: please check the transcript.',
          '',
          msg.message,
          '',
          msg.transcriptUrl && `Transcript: ${msg.transcriptUrl}`,
        ].filter((l) => l !== false && l != null).join('\n'),
      });
    },
  };
}
