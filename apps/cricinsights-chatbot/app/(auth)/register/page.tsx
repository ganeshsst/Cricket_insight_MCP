import { redirect } from "next/navigation";

/** Auth0 handles sign-up/sign-in; legacy Auth.js /register is unused. */
export default function RegisterPage() {
  redirect("/auth/login?returnTo=/");
}
