const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();

// Keep the deployed API working out of the box, while allowing local and
// staging environments to override it with VITE_API_BASE_URL.
export const API_BASE_URL = (configuredApiBase || 'https://genro-backend.onrender.com').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function toPathSegment(value) {
  return encodeURIComponent(String(value));
}

async function request(path, options = {}) {
  const { body, headers, timeoutMs = 55000, ...requestOptions } = options;
  let response;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('The Genro server is taking longer than expected to wake up. Please try again in a moment.');
    }
    throw new ApiError('We could not reach the Genro server. Check your connection and try again.');
  } finally {
    window.clearTimeout(timeout);
  }

  const rawBody = await response.text();
  let payload = null;

  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    throw new ApiError('The server returned an unexpected response.', response.status);
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || 'Something went wrong. Please try again.', response.status, payload);
  }

  return payload;
}

export const api = {
  health: () => request('/'),

  login: (credentials) => request('/api/auth/login', { method: 'POST', body: credentials }),
  sendOtp: (mobile_no) => request('/api/otp/send', { method: 'POST', body: { mobile_no } }),
  verifyOtp: (mobile_no, otp) => request('/api/otp/verify', { method: 'POST', body: { mobile_no, otp } }),
  signup: (details) => request('/api/signup', { method: 'POST', body: details }),

  getDashboard: (userId) => request(`/api/user/${toPathSegment(userId)}/dashboard`),
  updateProfile: (userId, profile) => request(`/api/user/${toPathSegment(userId)}/profile`, {
    method: 'PUT',
    body: profile,
  }),

  getProgress: (userId) => request(`/api/user/${toPathSegment(userId)}/progress`),
  saveProgress: (userId, progress) => request(`/api/user/${toPathSegment(userId)}/progress`, {
    method: 'POST',
    body: progress,
  }),

  getSyllabus: (classLevel, subject) => request(
    `/api/syllabus/${toPathSegment(classLevel)}/${toPathSegment(subject)}`,
  ),

  getTest: (id, kind = 'topic', difficulty = 'medium') => {
    const path = kind === 'chapter'
      ? `/api/test/chapter/${toPathSegment(id)}`
      : `/api/test/${toPathSegment(id)}`;
    return request(`${path}?difficulty=${toPathSegment(difficulty)}`);
  },

  getCustomTest: (topicIds, difficulty = 'Medium') => request('/api/test/custom', {
    method: 'POST',
    body: { topic_ids: topicIds, difficulty },
  }),

  getAttemptReport: (userId, attemptId) => request(
    `/api/user/${toPathSegment(userId)}/attempts/${toPathSegment(attemptId)}/report`,
  ),

  getChat: (userId) => request(`/api/chat/${toPathSegment(userId)}`),
  sendChat: (userId, message_text, attachment) => request(`/api/chat/${toPathSegment(userId)}`, {
    method: 'POST',
    body: { sender_type: 'User', message_text, attachment },
  }),
  updateChat: (userId, messageId, message_text) => request(`/api/chat/${toPathSegment(userId)}/${toPathSegment(messageId)}`, {
    method: 'PUT',
    body: { message_text },
  }),
  deleteChat: (userId, messageId) => request(`/api/chat/${toPathSegment(userId)}/${toPathSegment(messageId)}`, {
    method: 'DELETE',
  }),
};

export async function fetchQuizPayload(testUrl) {
  const url = new URL(testUrl, `${API_BASE_URL}/`).toString();
  let response;

  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError('The question set could not be loaded. Please try again.');
  }

  if (!response.ok) {
    throw new ApiError('The question set is not available right now.', response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError('The question set has an invalid format.');
  }
}