import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOption";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) return null;

  return <SettingsClient session={session} />;
}
