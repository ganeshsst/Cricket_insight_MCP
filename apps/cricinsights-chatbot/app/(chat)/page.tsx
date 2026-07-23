import { auth0 } from '@/lib/auth0';
import { ChatShell } from '@/components/cricinsights/chat/ChatShell';

export default async function CricketChatPage() {
  const session = await auth0.getSession();
  const user = session?.user;

  return (
    <ChatShell
      userName={typeof user?.name === 'string' ? user.name : null}
      userPicture={typeof user?.picture === 'string' ? user.picture : null}
    />
  );
}
