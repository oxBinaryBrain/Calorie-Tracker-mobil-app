import type { ApiClient } from '../types';
import { MockApi } from './mock';
import { HttpApi } from './http';

/**
 * One switch for the whole app: set EXPO_PUBLIC_API_BASE_URL to leave mock
 * mode. See docs/BACKEND.md for the exact endpoints and response shapes.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export const usingMockApi = !BASE_URL;

export const api: ApiClient = BASE_URL ? new HttpApi(BASE_URL) : new MockApi();
