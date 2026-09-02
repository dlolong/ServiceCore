export type MaintenanceBackfillMode="dry-run"|"apply";
export type MaintenanceBackfillOptions={organizationId:string;limit:number;mode:MaintenanceBackfillMode;reportId:string};
export type MaintenanceBackfillRepository={
  plan(input:{organizationId:string;limit:number}):Promise<unknown>;
  apply(input:{organizationId:string;limit:number;reportId:string}):Promise<unknown>;
};

export async function runMaintenanceBackfill(options:MaintenanceBackfillOptions,repository:MaintenanceBackfillRepository){
  const result=options.mode==="apply"
    ?await repository.apply({organizationId:options.organizationId,limit:options.limit,reportId:options.reportId})
    :await repository.plan({organizationId:options.organizationId,limit:options.limit});
  return{reportId:options.reportId,generatedAt:new Date().toISOString(),mode:options.mode,
    scope:{organizationId:options.organizationId,limit:options.limit},result};
}

export function assertMaintenanceBackfillApplySafety(input:{mode:MaintenanceBackfillMode;organizationId:string;nodeEnvironment?:string;productionConfirmation?:string;confirmProduction:boolean}){
  if(input.mode!=="apply"||input.nodeEnvironment!=="production")return;
  if(!input.confirmProduction||input.productionConfirmation!==input.organizationId){
    throw new Error("Production apply requires --confirm-production and MAINTENANCE_BACKFILL_PRODUCTION_CONFIRM set to the organization UUID.");
  }
}
