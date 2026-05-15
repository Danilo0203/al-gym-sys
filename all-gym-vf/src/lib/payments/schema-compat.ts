type SchemaErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "";
  }

  return String(error.code || "");
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return "";
  }

  return String(error.message || "").toLowerCase();
}

export function isPaymentsStatusColumnMissingError(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  return (
    code === "42703" ||
    message.includes("payments.status") ||
    message.includes("column status does not exist") ||
    (message.includes("schema cache") && message.includes("status") && message.includes("payments"))
  );
}

export async function runPaymentsPostedQueryCompat<T>(
  buildQuery: (
    usePostedFilter: boolean,
  ) => PromiseLike<{
    data: T;
    error: SchemaErrorLike | null;
  }>,
) {
  const result = await buildQuery(true);
  if (result.error && isPaymentsStatusColumnMissingError(result.error)) {
    return buildQuery(false);
  }

  return result;
}
