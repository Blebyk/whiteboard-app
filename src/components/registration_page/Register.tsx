'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Данные регистрации:', formData)
    // Здесь будет логика отправки данных
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
      {/* Белая карточка с формой */}
      <div style={{
        color: '#333',
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        {/* Заголовок */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#333',
          textAlign: 'center',
          marginBottom: '8px'
        }}>
          Создайте аккаунт
        </h1>

        {/* Описание */}
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

        {/* Форма */}
        <form onSubmit={handleSubmit}>
          {/* Поле имени */}
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              name="name"
              placeholder="Имя пользователя"
              value={formData.name}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#f8f9fa',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          {/* Поле email */}
          <div style={{ marginBottom: '16px' }}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#f8f9fa',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          {/* Поле пароля */}
          <div style={{ marginBottom: '24px' }}>
            <input
              type="password"
              name="password"
              placeholder="Пароль"
              value={formData.password}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#f8f9fa',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
            />
          </div>

          {/* Кнопка регистрации */}
          <button
            type="submit"
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
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
          >
            Зарегистрироваться
          </button>
        </form>

        {/* Ссылка на вход */}
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
      </div>
    </main>
  )
}