const dateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return `${dateTime.format(new Date(iso))} WIB`;
}
