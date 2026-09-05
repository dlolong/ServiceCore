import type { FeatureAccessRequirement } from "@/modules/platform/features";
import { roleHasPermission } from "@/lib/rbac";
import type { OrganizationMembership } from "@/lib/auth/context";
import { industrySupportsFeature, type IndustryConfig } from "@/modules/platform/industry";

export type NavigationItem = FeatureAccessRequirement & {
  key: string;
  label: string;
  href: string;
  mobileLabel?: string;
  importance: NavigationImportance;
};

export const navigationImportanceOrder = ["primary", "operations", "management"] as const;
export type NavigationImportance = (typeof navigationImportanceOrder)[number];

const navigationGroupLabels: Record<NavigationImportance, string> = {
  primary: "Daily work",
  operations: "Business operations",
  management: "Management",
};

export type NavigationGroup = {
  importance: NavigationImportance;
  label: string;
  items: readonly NavigationItem[];
};

export const karkrNavigation = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", importance: "primary" },
  { key: "appointments", label: "Appointments", mobileLabel: "Booking", href: "/dashboard/appointments", importance: "primary", industryFeature: "appointments", permission: "appointments.manage" },
  { key: "queue", label: "Queue", href: "/dashboard/queue", importance: "primary", industryFeature: "queue", permission: "appointments.manage" },
  { key: "jobs", label: "Job Orders", href: "/dashboard/jobs", importance: "primary", industryFeature: "job_orders", permission: "jobs.execute" },
  { key: "my_work", label: "My Work", href: "/dashboard/my-work", importance: "primary", industryFeature: "job_orders", permission: "jobs.execute" },
  { key: "bookings", label: "Booking Requests", href: "/dashboard/bookings", importance: "operations", industryFeature: "booking_requests", permission: "appointments.manage" },
  { key: "customers", label: "Customers", href: "/dashboard/customers", importance: "operations", permission: "customers.read" },
  { key: "vehicles", label: "Vehicles", href: "/dashboard/vehicles", importance: "operations", industryFeature: "vehicles", permission: "vehicles.read" },
  { key: "payments", label: "Payments", href: "/dashboard/payments", importance: "operations", industryFeature: "payments", permission: "payments.record" },
  { key: "inventory", label: "Inventory", href: "/dashboard/inventory", importance: "operations", industryFeature: "inventory", permission: "inventory.manage" },
  { key: "reminders", label: "Maintenance", href: "/dashboard/reminders", importance: "operations", industryFeature: "maintenance", subscriptionFeature: "reminders" },
  { key: "services", label: "Services", href: "/dashboard/services", importance: "management", permission: "services.manage" },
  { key: "reports", label: "Reports", href: "/dashboard/reports", importance: "management", subscriptionFeature: "advanced_reports", permission: "reports.view" },
  { key: "settings", label: "Settings", href: "/dashboard/settings", importance: "management", permission: "settings.manage" },
] as const satisfies readonly NavigationItem[];

const salonNavigation = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", importance: "primary" },
  { key: "appointments", label: "Appointments", mobileLabel: "Bookings", href: "/dashboard/appointments", importance: "primary", industryFeature: "appointments", permission: "appointments.manage" },
  { key: "customers", label: "Clients", href: "/dashboard/customers", importance: "operations", permission: "customers.read" },
  { key: "services", label: "Treatments", href: "/dashboard/services", importance: "operations", permission: "services.manage" },
  { key: "staff", label: "Staff", href: "/dashboard/settings/staff", importance: "operations", permission: "settings.manage" },
  { key: "resources", label: "Resources", href: "/dashboard/settings/resources", importance: "operations", industryFeature: "resources", permission: "settings.manage" },
  { key: "inventory", label: "Inventory", href: "/dashboard/inventory", importance: "operations", industryFeature: "inventory", permission: "inventory.manage" },
  { key: "settings", label: "Settings", href: "/dashboard/settings", importance: "management", permission: "settings.manage" },
] as const satisfies readonly NavigationItem[];

export function navigationForIndustry(config: IndustryConfig, role?: OrganizationMembership["role"]): readonly NavigationItem[] {
  const navigation: readonly NavigationItem[] = config.key === "salon" ? salonNavigation : karkrNavigation;
  return navigation.filter((item) =>
    (!item.industryFeature || industrySupportsFeature(config, item.industryFeature))
    && (!role || !item.permission || roleHasPermission(role, item.permission)),
  );
}

export function groupNavigationByImportance(items: readonly NavigationItem[]): NavigationGroup[] {
  return navigationImportanceOrder.flatMap((importance) => {
    const groupItems = items.filter((item) => item.importance === importance);
    return groupItems.length > 0
      ? [{ importance, label: navigationGroupLabels[importance], items: groupItems }]
      : [];
  });
}
