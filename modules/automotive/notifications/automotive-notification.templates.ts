import type { NotificationTemplateRenderer } from "@/lib/notifications/outbox";
import { renderEstimateApprovalNotification } from "@/modules/automotive/notifications/estimate-approval.templates";
import { renderVehicleMaintenanceNotification } from "@/modules/automotive/notifications/vehicle-maintenance.templates";

export function renderAutomotiveNotification(appUrl:string):NotificationTemplateRenderer{
  const renderEstimate=renderEstimateApprovalNotification(appUrl);
  return input=>input.templateKey.startsWith("vehicle-maintenance-")
    ?renderVehicleMaintenanceNotification(input)
    :renderEstimate(input);
}
