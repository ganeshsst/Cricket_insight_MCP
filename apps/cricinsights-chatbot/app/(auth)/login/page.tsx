import { redirect } from "next/navigation";

/** Auth0 handles sign-in; legacy Auth.js /login is unused. */
export default function LoginPage() {
  redirect("/auth/login?returnTo=/");
}
