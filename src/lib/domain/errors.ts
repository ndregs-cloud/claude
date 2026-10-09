/** Error bisnis yang aman ditampilkan ke pengguna (pesan sudah dalam Bahasa Indonesia). */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
