export type UserRole = "customer" | "admin" | "manager" | "editor";

export interface User {
  id: string;
  name: string;
  email?: string;
  phone: string;
  avatar?: string;
  role: UserRole;
}

export interface Session {
  user: User;
  token: string;
  expires_at: string;
}

export interface OtpPayload {
  phone: string;
  method: "sms";
}

export interface OtpVerifyPayload {
  phone: string;
  otp: string;
}
