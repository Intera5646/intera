import { redirect } from 'next/navigation';

export default function PreviewRedirectPage() {
  redirect('/dashboard');
}
