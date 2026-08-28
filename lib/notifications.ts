export type ReminderMessage={to:string;subject:string;body:string;idempotencyKey:string};
export type DeliveryResult={providerMessageId:string};
export interface EmailProvider{send(message:ReminderMessage):Promise<DeliveryResult>}
export interface SmsProvider{send(message:Omit<ReminderMessage,"subject">):Promise<DeliveryResult>}
export class UnconfiguredEmailProvider implements EmailProvider{async send(message:ReminderMessage):Promise<DeliveryResult>{void message;throw new Error("Email provider is not configured.")}}
export class UnconfiguredSmsProvider implements SmsProvider{async send(message:Omit<ReminderMessage,"subject">):Promise<DeliveryResult>{void message;throw new Error("SMS provider is not configured.")}}
