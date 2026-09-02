import { z } from "zod";

import { estimateApprovalTokenSchema } from "@/modules/automotive/work-execution/estimate-approval";
import type { NotificationTemplateRenderer } from "@/lib/notifications/outbox";

const payloadSchema=z.object({
  businessName:z.string().min(1),branchName:z.string().min(1),vehicleLabel:z.string(),plateNumber:z.string().nullable(),
  amountCentavos:z.coerce.number().int().nonnegative(),expiresAt:z.iso.datetime({offset:true}),
});

const money=new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"});
const expiry=new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Manila"});

export function renderEstimateApprovalNotification(appUrl:string):NotificationTemplateRenderer{
  return({templateKey,payload,deliverySecret})=>{
    const data=payloadSchema.parse(payload);
    const token=estimateApprovalTokenSchema.parse(deliverySecret);
    const approvalUrl=new URL(`/estimate/${token}`,appUrl).toString();
    const vehicle=[data.vehicleLabel,data.plateNumber].filter(Boolean).join(" • ");
    const amount=money.format(data.amountCentavos/100);
    const expires=expiry.format(new Date(data.expiresAt));
    const reminder=templateKey.startsWith("estimate-approval-reminder-");

    if(templateKey.endsWith("-email-v1"))return{
      subject:reminder?`Reminder: review your ${data.businessName} estimate`:`Your ${data.businessName} estimate is ready`,
      body:[
        reminder?"Your service estimate is still awaiting your decision.":"Your service estimate is ready for review.",
        "",`Vehicle: ${vehicle||"Your vehicle"}`,`Estimate: ${amount}`,"",`Review and approve: ${approvalUrl}`,
        `This private link expires ${expires}.`,"",data.businessName,data.branchName,
      ].join("\n"),
    };
    if(templateKey.endsWith("-sms-v1"))return{
      body:`${data.businessName}: ${reminder?"Reminder—your":"Your"} estimate for ${vehicle||"your vehicle"} is ${amount}. Review: ${approvalUrl}. Expires ${expires}.`,
    };
    throw new Error("Unsupported notification template.");
  };
}
