'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendCooldown, setResendCooldown] = useState(0);

  async function handleResend() {
    setResendStatus('sending');
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      setResendStatus('sent');
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setResendStatus('error');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Ошибка регистрации'); return; }
      setSuccess(true);
    } catch {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  }

  const passwordsMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f0f2f5',
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
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.55, marginBottom: 20 }}>
              Мы отправили письмо с подтверждением на<br />
              <strong style={{ color: '#1a1a2e' }}>{form.email}</strong>
            </p>
            <div style={{
              backgroundColor: '#eef2ff', padding: '14px 16px', borderRadius: 8,
              marginBottom: 24, fontSize: 13, color: '#4338ca', lineHeight: 1.55, textAlign: 'left',
            }}>
              Перейдите по ссылке в письме для завершения регистрации. Ссылка действительна 24 часа.
            </div>
            <button
              onClick={() => router.push('/login')}
              style={{
                width: '100%', padding: '13px', backgroundColor: '#4f46e5',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.2s',
              }}
            >
              Перейти ко входу
            </button>

            {/* Повторная отправка */}
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Не получили письмо?</p>
              {resendStatus === 'sent' ? (
                <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Письмо отправлено повторно
                  {resendCooldown > 0 && <span style={{ color: '#9ca3af', fontWeight: 400 }}> · повтор через {resendCooldown}с</span>}
                </p>
              ) : resendStatus === 'error' ? (
                <p style={{ fontSize: 13, color: '#dc2626' }}>Не удалось отправить. Попробуйте позже.</p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendStatus === 'sending' || resendCooldown > 0}
                  style={{
                    background: 'none', border: 'none',
                    color: resendCooldown > 0 ? '#9ca3af' : '#4f46e5',
                    fontSize: 13, fontWeight: 600,
                    cursor: resendCooldown > 0 ? 'default' : 'pointer',
                    padding: 0, textDecoration: resendCooldown > 0 ? 'none' : 'underline',
                    fontFamily: 'inherit',
                  }}
                >
                  {resendStatus === 'sending' ? 'Отправка...' : resendCooldown > 0 ? `Повторить через ${resendCooldown}с` : 'Отправить письмо повторно'}
                </button>
              )}
            </div>
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

                {/* Пароль с кнопкой показать/скрыть */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Пароль</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      placeholder="••••••••"
                      onChange={handleChange}
                      required
                      disabled={loading}
                      minLength={6}
                      style={{
                        width: '100%', padding: '12px 44px 12px 14px',
                        border: '1.5px solid #ddd', borderRadius: 8,
                        fontSize: 15, boxSizing: 'border-box', outline: 'none',
                        fontFamily: 'inherit', background: 'white', color: '#1a1a2e',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
                      onBlur={(e) => (e.target.style.borderColor = '#ddd')}
                    />
                    <EyeButton show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Минимум 6 символов</div>
                </div>

                {/* Подтверждение пароля */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Подтвердите пароль</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      name="confirmPassword"
                      value={form.confirmPassword}
                      placeholder="••••••••"
                      onChange={handleChange}
                      required
                      disabled={loading}
                      style={{
                        width: '100%', padding: '12px 44px 12px 14px',
                        border: `1.5px solid ${passwordsMismatch ? '#fca5a5' : passwordsMatch ? '#86efac' : '#ddd'}`,
                        borderRadius: 8, fontSize: 15, boxSizing: 'border-box',
                        outline: 'none', fontFamily: 'inherit', background: 'white',
                        color: '#1a1a2e', transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => {
                        if (!passwordsMismatch && !passwordsMatch) e.target.style.borderColor = '#4f46e5';
                      }}
                      onBlur={(e) => {
                        if (!passwordsMismatch && !passwordsMatch) e.target.style.borderColor = '#ddd';
                      }}
                    />
                    <EyeButton show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
                  </div>
                  {passwordsMismatch && (
                    <div style={{ fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Пароли не совпадают
                    </div>
                  )}
                  {passwordsMatch && (
                    <div style={{ fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Пароли совпадают
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div style={{
                  backgroundColor: '#fff0f0', border: '1px solid #fca5a5',
                  borderRadius: '8px', padding: '12px', marginBottom: '18px',
                  color: '#dc2626', fontSize: '14px',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || passwordsMismatch}
                style={{
                  width: '100%', padding: '13px',
                  backgroundColor: loading || passwordsMismatch ? '#a5b4fc' : '#4f46e5',
                  color: 'white', border: 'none', borderRadius: '8px',
                  fontSize: '15px', fontWeight: 700,
                  cursor: loading || passwordsMismatch ? 'not-allowed' : 'pointer',
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

// ── Кнопка показать/скрыть пароль ────────────────────────────────────────────
function EyeButton({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#9ca3af', padding: 2, display: 'flex', alignItems: 'center',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = '#4f46e5')}
      onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
      title={show ? 'Скрыть пароль' : 'Показать пароль'}
    >
      {show ? (
        // Eye-off
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        // Eye
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

// ── Обычное поле ──────────────────────────────────────────────────────────────
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
        type={type} name={name} value={value} placeholder={placeholder}
        onChange={onChange} required={required} disabled={disabled} minLength={minLength}
        style={{
          width: '100%', padding: '12px 14px', border: '1.5px solid #ddd',
          borderRadius: 8, fontSize: 15, boxSizing: 'border-box', outline: 'none',
          fontFamily: 'inherit', background: 'white', color: '#1a1a2e', transition: 'border-color 0.2s',
        }}
        onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
        onBlur={(e) => (e.target.style.borderColor = '#ddd')}
      />
      {hint && <div style={{ fontSize: 11, color: '#9ca3af' }}>{hint}</div>}
    </div>
  );
}
