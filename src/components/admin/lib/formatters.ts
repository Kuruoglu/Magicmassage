export function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    currency: "EUR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function statusClass(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus.includes("ожидает") || normalizedStatus.includes("новая")) {
    return "admin-status admin-status-warning";
  }

  if (normalizedStatus.includes("черновик")) {
    return "admin-status admin-status-warning";
  }

  if (normalizedStatus.includes("требует")) {
    return "admin-status admin-status-warning";
  }

  if (normalizedStatus.includes("отмен") || normalizedStatus.includes("возврат")) {
    return "admin-status admin-status-danger";
  }

  if (normalizedStatus.includes("скрыт")) {
    return "admin-status admin-status-danger";
  }

  return "admin-status admin-status-success";
}

export function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}
