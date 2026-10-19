import assert from "node:assert/strict";
import test from "node:test";
import { calculateAutomaticRenewalPeriod, calculateSubscriptionEndDate } from "./subscription-renewal-period";

function date(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function calendar(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

test("el cobro anticipado o tardío conserva el día de inicio de la mensualidad", () => {
  for (const paidOn of ["2026-08-02", "2026-08-08"]) {
    const period = calculateAutomaticRenewalPeriod(date("2026-07-04"), date("2026-08-04"), 31, date(paidOn));
    assert.equal(calendar(period.from), "2026-08-04");
    assert.equal(calendar(period.to), "2026-09-04");
  }
});

test("tras varios meses propone el período del mes de cobro sin mover el día", () => {
  const period = calculateAutomaticRenewalPeriod(date("2026-06-11"), date("2026-07-12"), 31, date("2026-10-06"));
  assert.equal(calendar(period.from), "2026-10-11");
  assert.equal(calendar(period.to), "2026-11-11");
});

test("una mensualidad de 31 días termina el mismo día del mes siguiente", () => {
  assert.equal(calendar(calculateSubscriptionEndDate(date("2026-09-11"), 31)), "2026-10-11");
});

test("los planes semanales avanzan según su duración", () => {
  const period = calculateAutomaticRenewalPeriod(date("2026-07-04"), date("2026-07-11"), 7, date("2026-07-20"));
  assert.equal(calendar(period.from), "2026-07-18");
  assert.equal(calendar(period.to), "2026-07-25");
});
