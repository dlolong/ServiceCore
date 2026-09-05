import type{NotificationTemplateRenderer}from"@/lib/notifications/outbox";

type Payload={businessName:string;branchName:string;clientFirstName:string;startsAt:string;timezone:string;treatments:string[];staffNames?:string[]};
export function renderSalonAppointmentReminder(appUrl:string):NotificationTemplateRenderer{return({templateKey,payload,deliverySecret})=>{
  if(!templateKey.startsWith("salon-appointment-reminder-")||!deliverySecret)throw new Error("Salon appointment reminder configuration is invalid.");
  const data=payload as Payload,time=new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:data.timezone}).format(new Date(data.startsAt));
  const url=`${appUrl}/appointment/${deliverySecret}`,staff=data.staffNames?.length?` with ${data.staffNames.join(", ")}`:"";
  if(templateKey.includes("-sms-"))return{body:`${data.businessName}: Hi ${data.clientFirstName}, reminder for ${data.treatments.join(", ")}${staff} on ${time} at ${data.branchName}. Confirm or reschedule: ${url}`};
  return{subject:`Appointment reminder from ${data.businessName}`,body:`Hi ${data.clientFirstName},\n\nThis is a reminder for your ${data.treatments.join(", ")} appointment${staff} on ${time} at ${data.branchName}.\n\nConfirm or reschedule securely: ${url}\n\nPlease contact the salon if you need help.`};
};}
