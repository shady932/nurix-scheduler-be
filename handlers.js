const EmailService = require("./services/email");
const emailService = new EmailService();
const TransformService = require("./services/transform");
const transformService = new TransformService();
const WebhookService = require("./services/webhook");
const webhookService = new WebhookService();

const sleepHandler = () => {
  const duration = Math.floor(Math.random() * (30000 - 10000 + 1)) + 10000;
  const end = Date.now() + duration;
  while (Date.now() < end) {
    // do nothing
  }
  return { sleptMs: duration };
};

module.exports = {
  sleep: sleepHandler,
  sendEmail: emailService.handler,
  webhook: webhookService.handler,
  transform: transformService.handler,
};
