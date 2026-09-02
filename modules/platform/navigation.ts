import type { FeatureAccessRequirement } from "@/modules/platform/features";

export type NavigationItem = FeatureAccessRequirement & {
  key: string;
  label: string;
  href: string;
  mobileLabel?: string;
};

export const karkrNavigation = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "customers", label: "Customers", href: "/dashboard/customers", permission: "customers.read" },
  { key: "vehicles", label: "Vehicles", href: "/dashboard/vehicles", industryFeature: "vehicles", permission: "vehicles.read" },
  { key: "appointments", label: "Appointments", mobileLabel: "Booking", href: "/dashboard/appointments", industryFeature: "appointments", permission: "appointments.manage" },
  { key: "queue", label: "Queue", href: "/dashboard/queue", industryFeature: "appointments", permission: "appointments.manage" },
  { key: "jobs", label: "Job Orders", href: "/dashboard/jobs", industryFeature: "job_orders", permission: "jobs.execute" },
  { key: "payments", label: "Payments", href: "/dashboard/payments", industryFeature: "payments", permission: "payments.record" },
  { key: "bookings", label: "Booking Requests", href: "/dashboard/bookings", industryFeature: "appointments", permission: "appointments.manage" },
  { key: "services", label: "Services", href: "/dashboard/services", permission: "services.manage" },
  { key: "inventory", label: "Inventory", href: "/dashboard/inventory", industryFeature: "inventory", permission: "inventory.manage" },
  { key: "reminders", label: "Maintenance", href: "/dashboard/reminders", subscriptionFeature: "reminders" },
  { key: "reports", label: "Reports", href: "/dashboard/reports", subscriptionFeature: "advanced_reports", permission: "reports.view" },
  { key: "settings", label: "Settings", href: "/dashboard/settings", permission: "settings.manage" },
] as const satisfies readonly NavigationItem[];
