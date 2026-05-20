'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка сервера');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f0f2f5',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ fontSize: '32px', color: '#1a1a2e', margin: 0, fontWeight: 800 }}>
            ✏️ Whiteboard
          </h1>
        </Link>
        <p style={{ color: '#666', marginTop: '8px' }}>Восстановление пароля</p>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '24px', color: '#1a1a2e' }}>Забыли пароль?</h2>
        <p style={{ margin: '0 0 28px', fontSize: '14px', color: '#666' }}>
          Введите email вашего аккаунта — мы отправим ссылку для сброса пароля.
        </p>

        {success ? (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '16px',
            color: '#15803d',
            fontSize: '14px',
            lineHeight: '1.5',
          }}>
            <strong>Письмо отправлено!</strong>
            <p style={{ margin: '8px 0 0' }}>
              Проверьте почту <strong>{email}</strong> и перейдите по ссылке для сброса пароля.
              Ссылка действительна 1 час.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#555', fontWeight: 600 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1.5px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
                onBlur={(e) => (e.target.style.borderColor = '#ddd')}
              />
            </div>

            {error && (
              <div style={{
                backgroundColor: '#fff0f0',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '18px',
                color: '#dc2626',
                fontSize: '14px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                backgroundColor: loading ? '#a5b4fc' : '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {loading ? 'Отправка...' : 'Отправить ссылку'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#666' }}>
          Вспомнили пароль?{' '}
          <Link href="/login" style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
