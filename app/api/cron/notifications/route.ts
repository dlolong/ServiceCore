import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { clientEnv } from "@/lib/env/client";
import { serverEnv } from "@/lib/env/server";
import { isAuthorizedNotificationCron } from "@/lib/notifications/cron-auth";
import { processNotificationOutboxBatch } from "@/lib/notifications/outbox";
import { notificationOutboxRepository } from "@/lib/notifications/outbox.runtime";
import { createDeliveryProviders } from "@/lib/notifications/providers";
import { renderAutomotiveNotification } from "@/modules/automotive/notifications/automotive-notification.templates";
import { enqueueDueEstimateApprovalReminders } from "@/modules/automotive/notifications/estimate-approval-reminders.runtime";
import { enqueueDueVehicleMaintenanceReminders } from "@/modules/automotive/notifications/vehicle-maintenance.runtime";

export const runtime="nodejs";

export async function POST(request:Request){
  if(!isAuthorizedNotificationCron(request,serverEnv.NOTIFICATION_CRON_SECRET)){
    return new NextResponse("Unauthorized",{status:401});
  }
  const [estimateRemindersQueued,maintenanceRemindersQueued]=await Promise.all([
    enqueueDueEstimateApprovalReminders(),enqueueDueVehicleMaintenanceReminders(),
  ]);
  const delivery=await processNotificationOutboxBatch({
    repository:notificationOutboxRepository,
    providers:createDeliveryProviders({
      emailProvider:serverEnv.EMAIL_PROVIDER,smsProvider:serverEnv.SMS_PROVIDER,nodeEnvironment:process.env.NODE_ENV,
    }),
    render:renderAutomotiveNotification(clientEnv.NEXT_PUBLIC_APP_URL),
    workerId:`notification-cron-${randomUUID()}`,
    deliverySecretKey:serverEnv.NOTIFICATION_LINK_ENCRYPTION_KEY,
  });
  return NextResponse.json({estimateRemindersQueued,maintenanceRemindersQueued,delivery});
}
