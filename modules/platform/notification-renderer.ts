import type{NotificationTemplateRenderer}from"@/lib/notifications/outbox";
import{renderAutomotiveNotification}from"@/modules/automotive/notifications/automotive-notification.templates";
import{renderSalonAppointmentReminder}from"@/modules/salon/notifications/appointment-reminder.templates";
export function renderPlatformNotification(appUrl:string):NotificationTemplateRenderer{const automotive=renderAutomotiveNotification(appUrl),salon=renderSalonAppointmentReminder(appUrl);return input=>input.templateKey.startsWith("salon-")?salon(input):automotive(input);}
