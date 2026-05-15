type CashSchemaErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export const CASH_MODULE_SETUP_MESSAGE =
  "El modulo de caja no esta inicializado en esta base. Aplica la migracion 20260330_cash_module_v1.sql y vuelve a cargar.";

export class CashModuleNotReadyError extends Error {
  constructor(message = CASH_MODULE_SETUP_MESSAGE) {
    super(message);
    this.name = "CashModuleNotReadyError";
  }
}

function getCashErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "";
  }

  return String(error.code || "");
}

function getCashErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return "";
  }

  return String(error.message || "").toLowerCase();
}

export function isCashSchemaError(error: unknown) {
  const code = getCashErrorCode(error);
  const message = getCashErrorMessage(error);

  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    code === "42883" ||
    (message.includes("schema cache") && message.includes("cash_")) ||
    message.includes("could not find the table 'public.cash_") ||
    message.includes("could not find the function public.open_cash_session") ||
    message.includes("could not find the function public.close_cash_session") ||
    message.includes("could not find the function public.record_manual_cash_movement") ||
    message.includes("could not find the function public.create_subscription_payment_for_existing_customer") ||
    message.includes("could not find the function public.renew_subscription_with_payment") ||
    message.includes("could not find the function public.reverse_and_recreate_payment")
  );
}

export function toCashActionError(error: unknown, defaultMessage: string) {
  if (isCashSchemaError(error)) {
    return new CashModuleNotReadyError();
  }

  if (error instanceof Error) {
    return new Error(`${defaultMessage}: ${error.message}`);
  }

  if (error && typeof error === "object" && "message" in error) {
    return new Error(`${defaultMessage}: ${String((error as CashSchemaErrorLike).message || "")}`);
  }

  return new Error(defaultMessage);
}

export function isCashModuleNotReadyError(error: unknown): error is CashModuleNotReadyError {
  return error instanceof CashModuleNotReadyError || (error instanceof Error && error.name === "CashModuleNotReadyError");
}
