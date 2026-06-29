import type { Session, OtpPayload, OtpVerifyPayload, User } from "@/types/auth";
import type { IAuthService } from "../interfaces/auth.interface";
import { delay, randomId } from "@/lib/utils";
import { DEFAULT_OTP } from "@/lib/constants";

const DEMO_ADMIN: User = {
  id: "admin-1",
  name: "Admin",
  email: "admin@chinexa.com",
  phone: "+8801700000000",
  role: "admin",
};

const DEMO_CUSTOMER: User = {
  id: "customer-1",
  name: "Fatima Akter",
  phone: "+8801712345678",
  role: "customer",
};

export class MockAuthService implements IAuthService {
  async sendOtp(data: OtpPayload): Promise<{ success: boolean; message: string }> {
    await delay(800);
    return {
      success: true,
      message: `OTP sent via ${data.method} to ${data.phone}. Use ${DEFAULT_OTP} for testing.`,
    };
  }

  async verifyOtp(data: OtpVerifyPayload): Promise<Session> {
    await delay(600);
    if (data.otp !== DEFAULT_OTP) {
      throw new Error("Invalid OTP. Use 123456 for testing.");
    }

    const isAdmin = data.phone === "+8801700000000";
    const user = isAdmin ? DEMO_ADMIN : { ...DEMO_CUSTOMER, phone: data.phone };

    return {
      user,
      token: `mock-token-${randomId()}`,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async getMe(token: string): Promise<User | null> {
    await delay(200);
    if (!token) return null;
    return DEMO_CUSTOMER;
  }

  async logout(): Promise<void> {
    await delay(200);
  }
}
