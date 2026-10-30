import assert from "node:assert/strict";
import test from "node:test";
import { collectionTotal, enrollmentLabel, type EnrollmentState } from "./enrollment-types";
import { buildCashCustomerCreatePayload, buildCashCustomerRenewalPayload } from "../cash/lib/local-customer-intake";

test("cobro desglosado mantiene la mensualidad y transporta la inscripción por separado", () => {
  const enrollment = { year: 2026, fee: 50 };
  const data = { full_name: "Cliente prueba", phone: "55551234", birth_date: new Date(1990,0,1), gender: "male" as const,
    plan_id: 1, amount_original: 150, final_price: 140, discount_amount: 10,
    start_date: new Date(2026,9,1), end_date: new Date(2026,10,1), enrollment };
  const created = buildCashCustomerCreatePayload(data);
  assert.equal(created.paid_membership.amountPaid,140);
  assert.deepEqual(created.paid_membership.enrollment,enrollment);
  assert.equal(collectionTotal(140,enrollment),190);
  assert.equal(collectionTotal(150),150);
  const renewed = buildCashCustomerRenewalPayload("id", { ...data, price:150, amount_paid:140, grace_days:3, payment_method:"cash" });
  assert.equal(renewed.amountPaid,140); assert.deepEqual(renewed.enrollment,enrollment);
  const unchecked = buildCashCustomerCreatePayload({ ...data, enrollment: undefined });
  assert.ok(!("enrollment" in unchecked.paid_membership));
});
test("estado reconocido y pagado muestran el año; pendiente no se presenta como inscrito", () => {
  const base: EnrollmentState = { year:2026, fee:50, amount:null, recorded_at:null, can_manage:true, can_collect:true, status:"pending" };
  assert.equal(enrollmentLabel(base),"Inscripción 2026: pendiente");
  assert.equal(enrollmentLabel({...base,status:"recognized"}),"Inscrito 2026");
  assert.equal(enrollmentLabel({...base,status:"paid"}),"Inscrito 2026");
  assert.equal(enrollmentLabel({...base,status:"needs_review"}),"Inscripción 2026: por verificar");
});
