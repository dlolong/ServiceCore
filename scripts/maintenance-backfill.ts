import { randomUUID } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { assertMaintenanceBackfillApplySafety,runMaintenanceBackfill,type MaintenanceBackfillMode,type MaintenanceBackfillRepository } from "../modules/automotive/maintenance/backfill";

try{loadEnvFile(".env.local");}catch{/* Environment may already be injected by the operator. */}

const uuidSchema=z.uuid();
function argumentValue(name:string){const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:undefined;}
function hasArgument(name:string){return process.argv.includes(name);}

async function main(){
  const apply=hasArgument("--apply"),explicitDryRun=hasArgument("--dry-run");
  if(apply&&explicitDryRun)throw new Error("Choose either --dry-run or --apply, not both.");
  const mode:MaintenanceBackfillMode=apply?"apply":"dry-run";
  const organizationId=uuidSchema.parse(argumentValue("--organization"));
  const limit=Number(argumentValue("--limit")??100);
  if(!Number.isInteger(limit)||limit<1||limit>(apply?100:500))throw new Error(`Limit must be between 1 and ${apply?100:500}.`);
  assertMaintenanceBackfillApplySafety({mode,organizationId,nodeEnvironment:process.env.NODE_ENV,
    productionConfirmation:process.env.MAINTENANCE_BACKFILL_PRODUCTION_CONFIRM,confirmProduction:hasArgument("--confirm-production")});

  const supabaseUrl=z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey=z.string().min(20).parse(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const client=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const repository:MaintenanceBackfillRepository={
    async plan(input){const{data,error}=await client.rpc("plan_vehicle_service_backfill",{p_organization_id:input.organizationId,p_limit:input.limit});if(error)throw new Error(`Dry-run failed: ${error.message}`);return data;},
    async apply(input){const{data,error}=await client.rpc("apply_vehicle_service_backfill",{p_organization_id:input.organizationId,p_limit:input.limit,p_report_id:input.reportId});if(error)throw new Error(`Apply failed: ${error.message}`);return data;},
  };

  const reportId=randomUUID();
  const report=await runMaintenanceBackfill({organizationId,limit,mode,reportId},repository);
  const reportDirectory=resolve("reports/maintenance-backfill");
  await mkdir(reportDirectory,{recursive:true});
  const reportPath=resolve(reportDirectory,`${new Date().toISOString().replaceAll(":","-")}-${reportId}.json`);
  await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`,{encoding:"utf8",flag:"wx"});
  const summary=(report.result as{summary?:unknown})?.summary??{};
  console.info("maintenance.backfill",{reportId,mode,scope:report.scope,summary,reportPath});
  console.info(mode==="dry-run"?"Dry run complete. No database writes were performed.":"Explicit apply batch complete. Customer notifications remain disabled for backfilled projections.");
}

main().catch((error:unknown)=>{
  console.error(error instanceof Error?error.message:"Maintenance backfill failed.");
  process.exitCode=1;
});
