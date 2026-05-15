import { differenceInDays } from "date-fns";

export interface CustomerWhatsApp {
  full_name: string | null;
  phone: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  last_check_in: string | null;
}

export interface WhatsAppContext {
  customerName: string;
  phone: string;
  startDate: string | null;
  endDate: string | null;
  lastCheckIn: string | null;
  isSubscriptionExpired: boolean;
}

export function buildWhatsAppContext(customer: CustomerWhatsApp): WhatsAppContext | null {
  const phone = customer.phone;
  if (!phone) return null;

  const now = new Date();

  let isSubscriptionExpired = false;
  if (customer.subscription_end_date) {
    try {
      const endDate = new Date(customer.subscription_end_date + "T00:00:00");
      if (!isNaN(endDate.getTime())) {
        isSubscriptionExpired = endDate < now;
      }
    } catch {
      // ignore
    }
  }

  return {
    customerName: customer.full_name || "Cliente",
    phone,
    startDate: customer.subscription_start_date,
    endDate: customer.subscription_end_date,
    lastCheckIn: customer.last_check_in,
    isSubscriptionExpired,
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Sin registro";
  try {
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Sin registro";
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "Sin registro";
  }
}

export function interpolateMessage(content: string, ctx: WhatsAppContext): {
  text: string;
  hasNoAttendanceData: boolean;
} {
  let hasNoAttendanceData = false;
  let daysSinceLastCheckIn = 0;
  let hasCheckInData = false;

  if (ctx.lastCheckIn) {
    try {
      const lastDate = new Date(ctx.lastCheckIn);
      if (!isNaN(lastDate.getTime())) {
        daysSinceLastCheckIn = differenceInDays(new Date(), lastDate);
        hasCheckInData = true;
      }
    } catch {
      // ignore
    }
  }

  const tokenContent = content.toLowerCase();
  const needsAttendanceData = tokenContent.includes("@dias") || tokenContent.includes("@dias_texto");

  if (needsAttendanceData && !hasCheckInData) {
    hasNoAttendanceData = true;
  }

  let daysText = "";
  if (!hasCheckInData) {
    daysText = "0 días";
  } else if (ctx.isSubscriptionExpired) {
    daysText = `Venció hace ${daysSinceLastCheckIn} días`;
  } else {
    daysText = `${daysSinceLastCheckIn} días`;
  }

  const lastCheckInText = hasCheckInData ? formatDate(ctx.lastCheckIn) : "Sin registro";

  let result = content;
  result = result.replace(/@cliente/g, ctx.customerName);
  result = result.replace(/@dias_texto/g, daysText);
  result = result.replace(/@dias/g, String(hasCheckInData ? daysSinceLastCheckIn : 0));
  result = result.replace(/@inicio/g, formatDate(ctx.startDate));
  result = result.replace(/@fin/g, formatDate(ctx.endDate));
  result = result.replace(/@ultimo_ingreso/g, lastCheckInText);

  return { text: result, hasNoAttendanceData };
}

export function buildWhatsAppUrl(ctx: WhatsAppContext, messageText: string): string {
  const cleanPhone = ctx.phone.replace(/\D/g, "");
  const encoded = encodeURIComponent(messageText);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}
