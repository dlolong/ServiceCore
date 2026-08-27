import assert from "node:assert/strict";import test from "node:test";import{canTransitionAppointment,formatDuration,formatMoney,inputDateTimeInZone,parseMoneyToCentavos,queueLabel,zonedDateTimeToUtc}from"../lib/operations";
test("parses PHP amounts without floating point",()=>{assert.equal(parseMoneyToCentavos("₱1,250.50"),125050n);assert.equal(parseMoneyToCentavos("1.999"),null)});
test("formats money and duration",()=>{assert.match(formatMoney(125050),/1,250\.50/);assert.equal(formatDuration(150),"2 hr 30 min")});
test("formats branch queue numbers",()=>{assert.equal(queueLabel("appointment",2),"A-002");assert.equal(queueLabel("walk_in",18),"W-018")});
test("allows only explicit appointment transitions",()=>{assert.equal(canTransitionAppointment("requested","confirm"),true);assert.equal(canTransitionAppointment("queued","cancel"),false)});
test("converts Manila local appointment time to UTC",()=>{const utc=zonedDateTimeToUtc("2026-08-28T10:00","Asia/Manila");assert.equal(utc?.toISOString(),"2026-08-28T02:00:00.000Z");assert.equal(inputDateTimeInZone(utc!,"Asia/Manila"),"2026-08-28T10:00")});
