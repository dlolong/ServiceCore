export type AppointmentVehicleSummary = {
  make: string | null;
  model: string | null;
  plateNumber?: string | null;
};

export function requireAutomotiveAppointmentVehicle(vehicleId: string | null | undefined) {
  if (!vehicleId) throw new Error("A vehicle is required for this KarKR automotive workflow.");
  return vehicleId;
}

export function automotiveAppointmentVehicleLabel(vehicle: AppointmentVehicleSummary | null) {
  if (!vehicle) return "Vehicle not assigned";
  const description = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle";
  return vehicle.plateNumber ? `${description} · ${vehicle.plateNumber}` : description;
}
