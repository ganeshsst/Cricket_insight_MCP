import Link from 'next/link';

type Props = {
  searchParams: Promise<{
    error?: string;
    code?: string;
    description?: string;
  }>;
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = params.error ?? 'unknown_error';
  const code = params.code;
  const description = params.description;

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
          Sign-in failed
        </h1>
        <p style={{ color: '#444', marginBottom: '1rem' }}>
          Auth0 returned an error before a session cookie could be created.
        </p>
        <dl
          style={{
            background: '#f4f4f5',
            padding: '1rem',
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <dt style={{ fontWeight: 600 }}>Error</dt>
          <dd style={{ margin: '0 0 0.75rem' }}>{error}</dd>
          {code ? (
            <>
              <dt style={{ fontWeight: 600 }}>Code</dt>
              <dd style={{ margin: '0 0 0.75rem' }}>{code}</dd>
            </>
          ) : null}
          {description ? (
            <>
              <dt style={{ fontWeight: 600 }}>Description</dt>
              <dd style={{ margin: 0 }}>{description}</dd>
            </>
          ) : null}
        </dl>
        <p style={{ marginTop: '1.25rem' }}>
          <Link href="/auth/login?returnTo=/">Try again</Link>
        </p>
        <p style={{ marginTop: '0.75rem', fontSize: 13, color: '#666' }}>
          In Auth0 Application Settings, confirm Allowed Callback URLs includes{' '}
          <code>http://localhost:3004/auth/callback</code> and Allowed Web
          Origins includes <code>http://localhost:3004</code>.
        </p>
      </div>
    </main>
  );
}
