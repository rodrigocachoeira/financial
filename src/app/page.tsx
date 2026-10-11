import { redirect } from "next/navigation";

// Until the reports exist, the transaction list is the home page.
export default function Home() {
  redirect("/transactions");
}
