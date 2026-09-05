export const salonAppointmentStatuses=["requested","confirmed","checked_in","in_service","completed","cancelled","no_show"] as const;
export type SalonAppointmentStatus=typeof salonAppointmentStatuses[number];
export type SalonAppointmentAction="confirm"|"arrive"|"start_service"|"complete"|"cancel"|"no_show";

const transitions:Partial<Record<SalonAppointmentStatus,readonly SalonAppointmentAction[]>>={
  requested:["confirm","arrive","cancel","no_show"],confirmed:["arrive","cancel","no_show"],checked_in:["start_service","cancel"],in_service:["complete"],
};
export function salonAppointmentActions(status:string):readonly SalonAppointmentAction[]{return transitions[status as SalonAppointmentStatus]??[];}
export function isSalonVerticalTransition(action:string){return ["confirm","arrive","start_service","complete","cancel","no_show"].includes(action);}
export const salonAppointmentActionLabels:Record<SalonAppointmentAction,string>={confirm:"Confirm appointment",arrive:"Check in",start_service:"Start service",complete:"Complete appointment",cancel:"Cancel appointment",no_show:"Mark no-show"};
