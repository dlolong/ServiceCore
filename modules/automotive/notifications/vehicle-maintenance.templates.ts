import { z } from "zod";

import type { NotificationTemplateRenderer } from "@/lib/notifications/outbox";

const payloadSchema=z.object({
  businessName:z.string().min(1),branchName:z.string().min(1),branchPhone:z.string().nullable(),
  branchEmail:z.string().nullable(),customerName:z.string().min(1),vehicleLabel:z.string().min(1),
  plateNumber:z.string().nullable(),serviceName:z.string().min(1),lastServiceAt:z.iso.datetime({offset:true}),
  lastServiceOdometerKm:z.number().int().nonnegative().nullable(),nextDueAt:z.iso.datetime({offset:true}).nullable(),
  nextDueOdometerKm:z.number().int().nonnegative().nullable(),stage:z.enum(["DUE_SOON","DUE","OVERDUE"]),
});

const dateFormat=new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeZone:"Asia/Manila"});

export const renderVehicleMaintenanceNotification:NotificationTemplateRenderer=({templateKey,payload})=>{
  const data=payloadSchema.parse(payload);
  const vehicle=[data.vehicleLabel,data.plateNumber].filter(Boolean).join(" • ");
  const due=[data.nextDueAt?dateFormat.format(new Date(data.nextDueAt)):null,data.nextDueOdometerKm!=null?`${data.nextDueOdometerKm.toLocaleString("en-PH")} km`:null].filter(Boolean).join(" or ");
  const stage=data.stage==="OVERDUE"?"overdue":data.stage==="DUE"?"due":"due soon";
  const contact=[data.branchPhone,data.branchEmail].filter(Boolean).join(" · ");
  if(templateKey.endsWith("-email-v1"))return{
    subject:`${data.serviceName} is ${stage} — ${data.businessName}`,
    body:[`Hi ${data.customerName},`,`Your ${data.serviceName} is ${stage} for ${vehicle}.`,due?`Recommended by: ${due}`:null,"","Contact the branch to schedule your visit.",contact||data.branchName,"",data.businessName,data.branchName].filter(value=>value!==null).join("\n"),
  };
  if(templateKey.endsWith("-sms-v1"))return{body:`${data.businessName}: ${data.serviceName} is ${stage} for ${vehicle}.${due?` Recommended by ${due}.`:""} Contact ${contact||data.branchName}.`};
  throw new Error("Unsupported vehicle maintenance notification template.");
};
