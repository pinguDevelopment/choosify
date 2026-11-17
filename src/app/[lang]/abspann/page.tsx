import { redirect } from "next/navigation";

// Früherer Name der Watchlist: alte Links und Lesezeichen landen auf der neuen Seite.
export default function AbspannRedirect() {
  redirect("/watchlist");
}
