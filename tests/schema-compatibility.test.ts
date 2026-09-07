import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isMissingCanonicalAutomotiveStaffColumn,
  isMissingCanonicalStaffProfileId,
  isMissingCommandCenterMetrics,
  isMissingAppointmentStaffProfileId,
  isMissingStaffDirectory,
  isMissingOptionalStaffRpc,
  isMissingStaffProfilesRpc,
  shouldUseLegacyAutomotiveDirectoryReads,
  shouldUseLegacyAutomotiveWorkReads,
} from "../lib/supabase/schema-compatibility";

const missingJobStaff = {
  code: "PGRST204",
  message: "Could not find the 'primary_technician_staff_id' column of 'job_orders' in the schema cache",
};
const missingSessionStaff = {
  code: "PGRST204",
  message: "Could not find the 'technician_staff_id' column of 'automotive_job_order_work_sessions' in the schema cache",
};
const missingProfileId = {
  code: "PGRST204",
  message: "Could not find the 'id' column of 'organization_staff_profiles' in the schema cache",
};
const missingDirectory = {
  code: "PGRST205",
  message: "Could not find the table 'public.staff_directory' in the schema cache",
};

test("schema compatibility recognizes only the missing Command Center RPC", () => {
  assert.equal(isMissingCommandCenterMetrics({
    code: "PGRST202",
    message: "Could not find the function public.get_command_center_shared_metrics(p_branch_ids, p_organization_id) in the schema cache",
  }), true);
  assert.equal(isMissingCommandCenterMetrics({ code: "PGRST202", message: "Could not find another function" }), false);
  assert.equal(isMissingCommandCenterMetrics({ code: "42501", message: "permission denied for get_command_center_shared_metrics" }), false);
});

test("schema compatibility recognizes only canonical Staff capabilities", () => {
  assert.equal(isMissingCanonicalAutomotiveStaffColumn(missingJobStaff), true);
  assert.equal(isMissingCanonicalAutomotiveStaffColumn(missingSessionStaff), true);
  assert.equal(isMissingCanonicalAutomotiveStaffColumn({ code: "PGRST204", message: "Could not find another column" }), false);
  assert.equal(isMissingStaffDirectory(missingDirectory), true);
  assert.equal(isMissingStaffDirectory({ code: "PGRST205", message: "Could not find another table" }), false);
  assert.equal(isMissingStaffProfilesRpc({ code: "PGRST202", message: "Could not find the function public.list_staff_profiles(p_organization_id) in the schema cache" }), true);
  assert.equal(isMissingStaffProfilesRpc({ code: "42501", message: "permission denied for list_staff_profiles" }), false);
  assert.equal(isMissingOptionalStaffRpc({
    code: "PGRST202",
    message: "Could not find the function public.assign_job_staff(p_job_id, p_staff_id) in the schema cache",
  }, "assign_job_staff"), true);
  assert.equal(isMissingOptionalStaffRpc({ code: "42501", message: "permission denied for assign_job_staff" }, "assign_job_staff"), false);
  assert.equal(isMissingAppointmentStaffProfileId({ code: "PGRST204", message: "Could not find the 'staff_profile_id' column of 'appointment_staff_assignments' in the schema cache" }), true);
  assert.equal(isMissingAppointmentStaffProfileId({
    code: "PGRST200",
    message: "Could not find a relationship between 'appointment_staff_assignments' and 'organization_staff_profiles' in the schema cache",
  }), true);
  assert.equal(isMissingAppointmentStaffProfileId({
    code: "PGRST200",
    message: "Could not find a relationship between 'appointments' and 'customers' in the schema cache",
  }), false);
  assert.equal(isMissingAppointmentStaffProfileId({ code: "42501", message: "permission denied for appointment_staff_assignments" }), false);
  assert.equal(isMissingCanonicalStaffProfileId(missingProfileId), true);
  assert.equal(isMissingCanonicalStaffProfileId({ code: "PGRST204", message: "Could not find the email column of organization_staff_profiles" }), false);
});

test("Automotive work fallback refuses to hide unrelated database failures", () => {
  assert.equal(shouldUseLegacyAutomotiveWorkReads({
    jobs: missingJobStaff,
    sessions: missingSessionStaff,
    actorProfile: missingProfileId,
  }), true);
  assert.equal(shouldUseLegacyAutomotiveWorkReads({
    jobs: { code: "42501", message: "permission denied" },
    sessions: missingSessionStaff,
    actorProfile: missingProfileId,
  }), false);
  assert.equal(shouldUseLegacyAutomotiveDirectoryReads({
    directory: missingDirectory,
    sessions: missingSessionStaff,
  }), true);
  assert.equal(shouldUseLegacyAutomotiveDirectoryReads({
    directory: { code: "42501", message: "permission denied" },
    sessions: missingSessionStaff,
  }), false);
});

test("rolling-deployment reads prefer canonical 0054/0055 capabilities and retain scoped legacy fallbacks", () => {
  const commandCenter = readFileSync("modules/core/command-center/command-center.runtime.ts", "utf8");
  const jobs = readFileSync("app/dashboard/jobs/page.tsx", "utf8");
  const work = readFileSync("app/dashboard/my-work/page.tsx", "utf8");
  const automotive = readFileSync("modules/automotive/command-center/automotive-command-center.runtime.ts", "utf8");

  assert.ok(commandCenter.indexOf('rpc("get_command_center_shared_metrics"') < commandCenter.indexOf("loadLegacySharedMetrics"));
  assert.match(commandCenter, /\.eq\("organization_id", scope\.organizationId\)\.in\("branch_id", scope\.branchIds\)/);
  assert.ok(jobs.indexOf("primary_technician_staff_id") < jobs.indexOf("primary_technician_user_id"));
  assert.ok(work.indexOf("shouldUseLegacyAutomotiveWorkReads") < work.lastIndexOf("primary_technician_user_id"));
  assert.ok(automotive.indexOf('from("staff_directory")') < automotive.indexOf('rpc("list_staff"'));
});

test("appointment assignment context keeps batched canonical and legacy Staff reads scoped", () => {
  const source = readFileSync("modules/core/scheduling/appointment-assignment-view.ts", "utf8");
  assert.ok(source.indexOf("staff_profile_id") < source.lastIndexOf("staff_membership_id"));
  assert.match(source, /isMissingAppointmentStaffProfileId\(staffResult\.error\)/);
  assert.match(source, /\.eq\("organization_id", organizationId\)/);
  assert.match(source, /\.in\("appointment_id", appointmentIds\)/);
  assert.match(source, /listOperationalStaffDirectory\(organizationId\)/);
  assert.match(source, /if \(resourceResult\.error\) throw/);
  assert.doesNotMatch(source, /for \([^)]*appointmentId[^)]*\)[\s\S]{0,100}await/);
});

test("Job Order work keeps pre-0055 Staff reads and writes available during migration rollout", () => {
  const page = readFileSync("app/dashboard/jobs/[jobId]/work/page.tsx", "utf8");
  const execution = readFileSync("modules/automotive/work-execution/job-order.runtime.ts", "utf8");
  const tracking = readFileSync("modules/automotive/work-tracking/work-session.runtime.ts", "utf8");

  assert.ok(page.indexOf("technician_staff_id") < page.lastIndexOf("technician_user_id"));
  assert.ok(page.indexOf('from("staff_directory")') < page.indexOf('rpc("list_staff"'));
  assert.match(page, /\.eq\("organization_id", organizationId\)/);
  assert.ok(execution.indexOf('rpc("assign_job_staff"') < execution.indexOf('rpc("assign_job"'));
  assert.ok(execution.indexOf('rpc("assign_job_item_staff"') < execution.indexOf('rpc("assign_job_item"'));
  assert.ok(tracking.indexOf('rpc("start_automotive_staff_work_session"') < tracking.indexOf('rpc("start_automotive_job_work_session"'));
});
