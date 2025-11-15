'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Register() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/user/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Ошибка регистрации')
        return
      }

      // Успешная регистрация
      setSuccess(true)
      
    } catch (err) {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      flex: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 20px',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        color: '#333',
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        {success ? (
          // Success State
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '64px',
              marginBottom: '20px',
              animation: 'fadeIn 0.5s ease-in'
            }}>
              ✉️
            </div>

            <h1 style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#28a745',
              marginBottom: '16px'
            }}>
              Проверьте ваш email
            </h1>

            <p style={{
              fontSize: '16px',
              color: '#666',
              lineHeight: '1.6',
              marginBottom: '24px'
            }}>
              Мы отправили письмо с подтверждением на<br />
              <strong style={{ color: '#333' }}>{formData.email}</strong>
            </p>

            <div style={{
              backgroundColor: '#e8f5e9',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '24px',
              fontSize: '14px',
              color: '#2e7d32',
              lineHeight: '1.5'
            }}>
              Перейдите по ссылке в письме для завершения регистрации.
              Письмо действительно 24 часа.
            </div>

            <button
              onClick={() => router.push('/')}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                marginBottom: '12px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
            >
              Вернуться на главную
            </button>

            <button
              onClick={() => setSuccess(false)}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'transparent',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5'
                e.currentTarget.style.borderColor = '#999'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.borderColor = '#ddd'
              }}
            >
              Не получили письмо?
            </button>
          </div>
        ) : (
          // Registration Form
          <>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#333',
              textAlign: 'center',
              marginBottom: '8px'
            }}>
              Создайте аккаунт
            </h1>

            <p style={{
              fontSize: '16px',
              color: '#666',
              textAlign: 'center',
              marginBottom: '30px',
              lineHeight: '1.5'
            }}>
              Быстрая и простая регистрация для<br />
              совместной работы.
            </p>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              name="name"
              placeholder="Имя пользователя"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: loading ? '#f0f0f0' : '#f8f9fa',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: loading ? '#f0f0f0' : '#f8f9fa',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <input
              type="password"
              name="password"
              placeholder="Пароль (минимум 6 символов)"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: loading ? '#f0f0f0' : '#f8f9fa',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#0056b3'
            }}
            onMouseOut={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#007bff'
            }}
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

            <p style={{
              textAlign: 'center',
              marginTop: '20px',
              fontSize: '14px',
              color: '#666'
            }}>
              Уже есть аккаунт?{' '}
              <Link
                href="/login"
                style={{
                  color: '#007bff',
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
              >
                Войти
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}