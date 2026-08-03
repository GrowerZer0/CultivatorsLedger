// apps/frontend/src/app/%28app%29/page.tsx

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}