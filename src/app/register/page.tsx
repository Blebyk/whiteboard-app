'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка регистрации');
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
      // Dotted whiteboard background — same pattern as login + editor canvas
      backgroundImage: 'radial-gradient(circle, #9aa5b4 1.2px, transparent 1.2px)',
      backgroundSize: '24px 24px',
      backgroundPosition: '0 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ fontSize: '32px', color: '#1a1a2e', margin: 0, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Whiteboard
          </h1>
        </Link>
        <p style={{ color: '#6b7280', marginTop: '8px', fontSize: 15 }}>
          {success ? 'Регистрация почти завершена' : 'Создайте аккаунт за минуту'}
        </p>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        boxSizing: 'border-box',
      }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 24, color: '#1a1a2e', fontWeight: 700 }}>
              Проверьте ваш email
            </h2>

            <p style={{
              fontSize: 14,
              color: '#555',
              lineHeight: 1.55,
              marginBottom: 20,
            }}>
              Мы отправили письмо с подтверждением на<br />
              <strong style={{ color: '#1a1a2e' }}>{form.email}</strong>
            </p>

            <div style={{
              backgroundColor: '#eef2ff',
              padding: '14px 16px',
              borderRadius: 8,
              marginBottom: 24,
              fontSize: 13,
              color: '#4338ca',
              lineHeight: 1.55,
              textAlign: 'left',
            }}>
              Перейдите по ссылке в письме для завершения регистрации.
              Ссылка действительна 24 часа.
            </div>

            <button
              onClick={() => router.push('/')}
              style={{
                width: '100%',
                padding: '13px',
                backgroundColor: '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              Вернуться на главную
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ margin: '0 0 28px', fontSize: '24px', color: '#1a1a2e', fontWeight: 700 }}>
              Регистрация
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
                <Field
                  label="Имя"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  placeholder="your@email.com"
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                <Field
                  label="Пароль"
                  name="password"
                  type="password"
                  value={form.password}
                  placeholder="••••••••"
                  onChange={handleChange}
                  hint="Минимум 6 символов"
                  minLength={6}
                  required
                  disabled={loading}
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
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '24px', marginBottom: 0, fontSize: '14px', color: '#6b7280' }}>
              Уже есть аккаунт?{' '}
              <Link href="/login" style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>
                Войти
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ───── Shared input field — label on top, indigo focus, optional hint
interface FieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  minLength?: number;
}

function Field({ label, name, type = 'text', value, placeholder, onChange, hint, required, disabled, minLength }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        required={required}
        disabled={disabled}
        minLength={minLength}
        style={{
          width: '100%',
          padding: '12px 14px',
          border: '1.5px solid #ddd',
          borderRadius: 8,
          fontSize: 15,
          boxSizing: 'border-box',
          outline: 'none',
          fontFamily: 'inherit',
          background: 'white',
          color: '#1a1a2e',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
        onBlur={(e) => (e.target.style.borderColor = '#ddd')}
      />
      {hint && <div style={{ fontSize: 11, color: '#9ca3af' }}>{hint}</div>}
    </div>
  );
}
