import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Navigation from '@/components/Navigation';
import CalendarView from '@/components/CalendarView';
import { getTranslations } from 'next-intl/server';

export default async function CalendarPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const t = await getTranslations('calendar');

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/calendar"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-bold text-foreground mb-6">{t('title')}</h1>
          <CalendarView />
        </div>
      </main>
    </div>
  );
}
