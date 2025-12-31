type RiskMode = "score" | "full";

export async function callRiskAPI(
  token: string,
  mode: RiskMode,
  payload: {
    repo: string;
    files: string[];
    change: string;
  }
) {
  const res = await fetch(
    `${process.env.CODREL_API_BASE}/api/risk-analysis?mode=${mode}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`risk-api ${res.status}: ${t}`);
  }

  return res.json();
}
