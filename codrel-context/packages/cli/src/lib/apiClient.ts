export interface ApiRequestBody {
  token: string;
  [key: string]: any;
}

export interface ApiResponse {
  [key: string]: any;
}

export const apiClient = {
  async request<T extends ApiResponse = ApiResponse>(
    path: string,
    body: ApiRequestBody
  ): Promise<T> {
    const { token, ...rest } = body;

    const res = await fetch(`https://codrel-dashboard.vercel.app/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "codrelai_client": "cli"
      },
      body: JSON.stringify({token, ...rest }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${msg}`);
    }

    return (await res.json()) as T;
  }
};
