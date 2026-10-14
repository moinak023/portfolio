export interface SendEmailBinding {
  send(message: { to: string | string[]; from: string; subject: string; html?: string; text?: string }): Promise<unknown>;
}

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  EMAIL?: SendEmailBinding;
  SITE_NAME: string;
  MAIL_FROM: string;
  MAIL_FROM_NAME: string;
  DEV_OTP: string;
  MAIL_PROVIDER: string;
  RESEND_API_KEY?: string;
  MAIL_REPLY_TO?: string;
  /** The site owner. The only person who can administer the portfolio, and the only address password codes are sent to. */
  OWNER_EMAIL?: string;
  /** Minutes without activity before an admin session ends. Default 30. */
  IDLE_MINUTES?: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'admin';
  status: 'active' | 'disabled';
  created_at: number;
  password_hash?: string;
  password_set_at?: number | null;
}

export type Vars = { member: Member };
