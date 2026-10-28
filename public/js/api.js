const TemuBalikAPI = (() => {
  const TOKEN_KEY = 'tb_auth_token';
  const USER_KEY = 'tb_current_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getCurrentUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Terjadi kesalahan pada server');
    }
    return data;
  }

  return {
    getCurrentUser,
    setSession,
    clearSession,

    // Autentikasi
    login: (email, password) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

    register: (display_name, email, password) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify({ display_name, email, password }) }),

    // Laporan
    getReports: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/reports${qs ? `?${qs}` : ''}`);
    },

    getReportById: (id) => request(`/reports/${id}`),

    createReport: (payload) =>
      request('/reports', { method: 'POST', body: JSON.stringify(payload) }),

    updateReportStatus: (id, status) =>
      request(`/reports/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

    flagReport: (id, reason) =>
      request(`/reports/${id}/flag`, { method: 'POST', body: JSON.stringify({ reason }) }),

    // Klaim & Verifikasi
    submitClaim: (reportId, message) =>
      request(`/reports/${reportId}/claims`, { method: 'POST', body: JSON.stringify({ message }) }),

    getMyDashboard: () => request('/dashboard'),

    verifyClaim: (claimId, verification_status) =>
      request(`/claims/${claimId}/verify`, { method: 'PATCH', body: JSON.stringify({ verification_status }) }),

    // Moderasi
    getModerationQueue: () => request('/moderation/queue'),

    moderateReport: (reportId, action, reason) =>
      request('/moderation/action', { method: 'POST', body: JSON.stringify({ report_id: reportId, action, reason }) })
  };
})();