/** Automotive records extend the shared platform without becoming core requirements. */
export type Vehicle = {
  id: string;
  organizationId: string;
  customerId: string;
  make: string;
  model: string;
  modelYear: number | null;
  plateNumber: string | null;
  vin: string | null;
  odometerKm: number | null;
};

export type VehicleInspection = {
  id: string;
  organizationId: string;
  jobOrderId: string;
  odometerIn: number | null;
  completedAt: string | null;
};

export type JobOrderStatus = "draft" | "queued" | "in_progress" | "quality_check" | "ready" | "completed" | "cancelled";

export type JobOrder = {
  id: string;
  organizationId: string;
  branchId: string;
  customerId: string;
  vehicleId: string;
  status: JobOrderStatus;
};

export type JobOrderItem = {
  id: string;
  organizationId: string;
  jobOrderId: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPriceCentavos: bigint;
};

export type MaintenanceRecord = {
  id: string;
  organizationId: string;
  vehicleId: string;
  jobOrderId: string | null;
  servicedAt: string;
  odometerKm: number | null;
};

/** Automotive association kept outside the shared appointment model. */
export type AutomotiveAppointmentSubject = {
  appointmentId: string;
  organizationId: string;
  vehicleId: string;
};
