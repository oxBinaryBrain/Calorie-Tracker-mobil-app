import type {
  ApiClient,
  AuthSession,
  OnboardingPayload,
  ParseResult,
  TargetEdit,
  UserTargets,
} from '../types';
import { storageGet, storageSet } from '../services/storage';

const TOKEN_KEY = 'caloria.token';

/**
 * HttpApi — real backend implementation of the contract in docs/BACKEND.md.
 * Enabled by setting EXPO_PUBLIC_API_BASE_URL; the bearer token is kept in
 * expo-secure-store.
 */
export class HttpApi implements ApiClient {
  constructor(private baseUrl: string) {}

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const token = await storageGet(TOKEN_KEY);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const data = (await res.json()) as { message?: string; error?: string };
        message = data.message || data.error || message;
      } catch {
        // keep default message
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
  }

  private async authRequest(path: string, body: Record<string, string>): Promise<AuthSession> {
    const session = await this.request<AuthSession>(path, body);
    await storageSet(TOKEN_KEY, session.token);
    return session;
  }

  login(email: string, password: string): Promise<AuthSession> {
    return this.authRequest('/auth/login', { email, password });
  }

  signup(email: string, password: string): Promise<AuthSession> {
    return this.authRequest('/auth/signup', { email, password });
  }

  async forgotPassword(email: string): Promise<void> {
    await this.request('/auth/forgot-password', { email });
  }

  async submitOnboarding(payload: OnboardingPayload): Promise<{ targets: UserTargets }> {
    return this.request<{ targets: UserTargets }>('/onboarding', payload);
  }

  async updateTargets(edit: TargetEdit): Promise<UserTargets> {
    return this.request<UserTargets>('/targets', edit);
  }

  parseText(input: string): Promise<ParseResult> {
    return this.request<ParseResult>('/entries/parse', { input });
  }

  parsePhoto(photoBase64: string): Promise<ParseResult> {
    return this.request<ParseResult>('/entries/parse-photo', { photoBase64 });
  }
}
