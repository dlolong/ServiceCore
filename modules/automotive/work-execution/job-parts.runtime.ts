import "server-only";

import { requireAutomotiveContext as getDashboardContext } from "@/lib/auth/industry-access";
import { createClient } from "@/lib/supabase/server";
import {
  AutomotiveJobPartsError,
  type AutomotiveJobPartsPersistence,
} from "@/modules/automotive/work-execution/job-parts.service";

function controlledError(error: { message: string } | null, fallback: string): never {
  const allowed = ["stock", "reservation", "part", "authorization", "start work", "locked"];
  const message = error && allowed.some((term) => error.message.toLowerCase().includes(term)) ? error.message : fallback;
  throw new AutomotiveJobPartsError(message);
}

export function createAutomotiveJobPartsPersistence(jobOrderId: string): AutomotiveJobPartsPersistence {
  return {
    async reserve(input) {
      await getDashboardContext();
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("reserve_job_part", {
        p_job_order_id: jobOrderId,
        p_item_id: input.inventoryItemId,
        p_quantity: input.quantity,
        p_idempotency_key: input.idempotencyKey,
      });
      if (error || !data) controlledError(error, "Unable to reserve this part.");
      return data;
    },
    async reserveAllRequired(requestJobOrderId, idempotencyKey) {
      await getDashboardContext();
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("reserve_job_required_parts", {
        p_job_order_id: requestJobOrderId,
        p_idempotency_key: idempotencyKey,
      });
      if (error || data === null) controlledError(error, "Unable to reserve the required parts.");
      return data;
    },
    async consume(input) {
      await getDashboardContext();
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("consume_job_part", {
        p_job_order_id: jobOrderId,
        p_reservation_id: input.reservationId,
        p_quantity: input.quantity,
        p_idempotency_key: input.idempotencyKey,
      });
      if (error || !data) controlledError(error, "Unable to record part usage.");
      return data;
    },
    async release(input) {
      await getDashboardContext();
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("release_job_part", {
        p_job_order_id: jobOrderId,
        p_reservation_id: input.reservationId,
        p_quantity: input.quantity,
        p_idempotency_key: input.idempotencyKey,
      });
      if (error || !data) controlledError(error, "Unable to release this reservation.");
      return data;
    },
  };
}
