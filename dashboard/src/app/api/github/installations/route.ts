import { NextResponse } from "next/server";
import { github } from "@/lib/github"; 
import { getAuthSession } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAuthSession();
  
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userLogin = (session.user as any).login;

    const response = await github.listInstallations() as any;
    
    const allInstallations = Array.isArray(response) ? response : (response.installations || []);

    let myInstallations = allInstallations.filter((inst: any) => 
      inst.account.login.toLowerCase() === userLogin.toLowerCase()
    );

    return NextResponse.json({ installations: myInstallations });

  } catch (error: any) {
    console.error("API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}