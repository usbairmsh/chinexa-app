import type { Session, OtpPayload, OtpVerifyPayload, User } from "@/types/auth";

export interface IAuthService {
  sendOtp(data: OtpPayload): Promise<{ success: boolean; message: string }>;
  verifyOtp(data: OtpVerifyPayload): Promise<Session>;
  getMe(token: string): Promise<User | null>;
  logout(): Promise<void>;
}
